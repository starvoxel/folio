# Effective WebKitGTK settings that matter for privacy, as a default WebKit2.Settings / WebContext reports them (what wry leaves untouched).
import gi
gi.require_version('WebKit2', '4.1')
from gi.repository import WebKit2
s = WebKit2.Settings()
for p in ['enable-hyperlink-auditing', 'enable-dns-prefetching', 'enable-javascript', 'enable-developer-extras', 'enable-site-specific-quirks',
          'enable-media-stream', 'enable-webrtc', 'enable-encrypted-media', 'enable-mediasource', 'enable-page-cache', 'enable-html5-database',
          'enable-html5-local-storage', 'allow-file-access-from-file-urls', 'enable-write-console-messages-to-stdout']:
    try: print(p, s.get_property(p))
    except Exception: print(p, 'n/a')
c = WebKit2.WebContext.get_default()
print('spell-checking-enabled', c.get_spell_checking_enabled())
print('sandbox-enabled-api-present', hasattr(c, 'set_sandbox_enabled'))
print('webkitgtk', WebKit2.get_major_version(), WebKit2.get_minor_version(), WebKit2.get_micro_version())
