//! "Real app" experiments, compiled only with `--features extras` so they cannot distort the measured slice:
//!  - `atomic_write`: temp file in the same directory, write, fsync, rename over the target, fsync the directory (Unix).
//!  - `FileLock`: an in-use lock file with stale-lock detection (dead pid on Unix, or no heartbeat for STALE_AFTER).
//!  - native CSV drag and drop through Tauri's drop event, and a native "open file" dialog command.
//! The official fs plugin (`tauri-plugin-fs`) has no fsync and no advisory lock, which is why this is Rust and not TypeScript.

use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

/// Write `bytes` to `target` so that a crash at any point leaves either the old file or the new one, never a mix.
pub fn atomic_write(target: &Path, bytes: &[u8]) -> io::Result<()> {
    let dir = target.parent().filter(|p| !p.as_os_str().is_empty()).unwrap_or(Path::new("."));
    let name = target.file_name().ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "no file name"))?;
    let tmp = dir.join(format!(".{}.tmp-{}", name.to_string_lossy(), std::process::id()));
    let result = (|| {
        let mut f = OpenOptions::new().write(true).create_new(true).open(&tmp)?;
        f.write_all(bytes)?;
        f.sync_all()?; // data and metadata to disk before the rename can make it visible
        drop(f);
        fs::rename(&tmp, target)?; // atomic replace on POSIX; MoveFileEx(REPLACE_EXISTING) on Windows
        #[cfg(unix)]
        File::open(dir)?.sync_all()?; // make the rename itself durable. Windows has no directory fsync.
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

/// How long without a heartbeat before a lock is considered abandoned.
pub const STALE_AFTER: Duration = Duration::from_secs(30);

#[derive(Debug)]
pub struct FileLock {
    path: PathBuf,
}

#[derive(Debug)]
pub enum LockError {
    HeldBy { pid: u32, host: String },
    Io(io::Error),
}
impl From<io::Error> for LockError {
    fn from(e: io::Error) -> Self {
        LockError::Io(e)
    }
}

fn host() -> String {
    std::env::var("HOSTNAME").or_else(|_| std::env::var("COMPUTERNAME")).unwrap_or_else(|_| "unknown".into())
}

#[cfg(unix)]
fn pid_alive(pid: u32) -> bool {
    // signal 0 checks existence without sending anything. EPERM still means "exists".
    let r = unsafe { libc::kill(pid as libc::pid_t, 0) };
    r == 0 || io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
}
#[cfg(not(unix))]
fn pid_alive(_pid: u32) -> bool {
    true // no cheap std-only liveness check on Windows; rely on the heartbeat age instead
}

fn parse(contents: &str) -> Option<(u32, String)> {
    let mut it = contents.lines();
    let pid = it.next()?.strip_prefix("pid=")?.parse().ok()?;
    let host = it.next()?.strip_prefix("host=")?.to_string();
    Some((pid, host))
}

impl FileLock {
    /// Create `path` exclusively. If it exists, take it over only when it is stale (owner dead on this host, or no heartbeat).
    pub fn acquire(path: &Path) -> Result<FileLock, LockError> {
        for _ in 0..2 {
            match OpenOptions::new().write(true).create_new(true).open(path) {
                Ok(mut f) => {
                    write!(f, "pid={}\nhost={}\n", std::process::id(), host())?;
                    f.sync_all()?;
                    return Ok(FileLock { path: path.to_path_buf() });
                }
                Err(e) if e.kind() == io::ErrorKind::AlreadyExists => {
                    let text = fs::read_to_string(path).unwrap_or_default();
                    let age = fs::metadata(path).and_then(|m| m.modified()).ok().and_then(|t| SystemTime::now().duration_since(t).ok()).unwrap_or(Duration::ZERO);
                    let (pid, h) = parse(&text).unwrap_or((0, String::new()));
                    let same_host = h == host();
                    let stale = age > STALE_AFTER || (same_host && pid != 0 && !pid_alive(pid));
                    if !stale {
                        return Err(LockError::HeldBy { pid, host: h });
                    }
                    fs::remove_file(path)?; // loop once more; if another process wins the race, create_new fails and we report it
                }
                Err(e) => return Err(e.into()),
            }
        }
        Err(LockError::HeldBy { pid: 0, host: "race".into() })
    }
    /// Touch the file so other instances see it as live.
    pub fn heartbeat(&self) -> io::Result<()> {
        File::options().write(true).open(&self.path)?.set_modified(SystemTime::now())
    }
}
impl Drop for FileLock {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

/// Native file drops arrive through Tauri's window event, not through the DOM. Only .csv paths are forwarded to the renderer.
pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(w) = app.get_webview_window("main") {
        let handle = app.handle().clone();
        w.on_window_event(move |e| {
            if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = e {
                let csv: Vec<String> = paths.iter().filter(|p| p.extension().is_some_and(|x| x.eq_ignore_ascii_case("csv"))).map(|p| p.display().to_string()).collect();
                if !csv.is_empty() {
                    let _ = handle.emit("folio://csv-dropped", csv);
                }
            }
        });
    }
    Ok(())
}

#[tauri::command]
pub async fn open_csv_dialog(app: AppHandle) -> Result<Option<String>, String> {
    // async so the blocking native dialog does not run on the main thread
    Ok(app.dialog().file().add_filter("CSV", &["csv"]).blocking_pick_file().map(|p| p.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmpdir(tag: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("folio-extras-{}-{}", tag, std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn atomic_write_replaces_and_leaves_no_temp() {
        let d = tmpdir("aw");
        let t = d.join("budget.folio");
        atomic_write(&t, b"one").unwrap();
        atomic_write(&t, b"two").unwrap();
        assert_eq!(fs::read(&t).unwrap(), b"two");
        let left: Vec<_> = fs::read_dir(&d).unwrap().map(|e| e.unwrap().file_name()).collect();
        assert_eq!(left.len(), 1, "only the target remains: {left:?}");
    }

    #[test]
    fn atomic_write_failure_keeps_old_content() {
        let d = tmpdir("awf");
        let t = d.join("budget.folio");
        atomic_write(&t, b"good").unwrap();
        // A directory in the way of the rename makes it fail after the temp file was written.
        let blocked = d.join("blocked");
        fs::create_dir_all(blocked.join("inner")).unwrap();
        assert!(atomic_write(&blocked, b"bad").is_err());
        assert_eq!(fs::read(&t).unwrap(), b"good");
        assert!(fs::read_dir(&d).unwrap().all(|e| !e.unwrap().file_name().to_string_lossy().contains(".tmp-")));
    }

    #[test]
    fn lock_is_exclusive_and_released_on_drop() {
        let d = tmpdir("lk");
        let p = d.join("budget.folio.lock");
        let a = FileLock::acquire(&p).unwrap();
        assert!(matches!(FileLock::acquire(&p), Err(LockError::HeldBy { .. })));
        a.heartbeat().unwrap();
        drop(a);
        assert!(FileLock::acquire(&p).is_ok());
    }

    #[cfg(unix)]
    #[test]
    fn stale_lock_from_dead_pid_is_taken_over() {
        let d = tmpdir("st");
        let p = d.join("budget.folio.lock");
        // pid 2^22 + a bit is beyond the default pid_max on Linux, so it does not exist.
        fs::write(&p, format!("pid=4194300\nhost={}\n", host())).unwrap();
        assert!(FileLock::acquire(&p).is_ok());
    }

    #[test]
    fn old_heartbeat_is_stale_even_for_a_live_pid_on_another_host() {
        let d = tmpdir("hb");
        let p = d.join("budget.folio.lock");
        fs::write(&p, "pid=1\nhost=some-other-machine\n").unwrap();
        assert!(matches!(FileLock::acquire(&p), Err(LockError::HeldBy { .. })), "fresh lock from another host is respected");
        File::options().write(true).open(&p).unwrap().set_modified(SystemTime::now() - STALE_AFTER - Duration::from_secs(5)).unwrap();
        assert!(FileLock::acquire(&p).is_ok(), "no heartbeat for longer than STALE_AFTER is taken over");
    }
}
