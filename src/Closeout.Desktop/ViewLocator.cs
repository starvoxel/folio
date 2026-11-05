// ------------------------------
// ViewLocator.cs
//
// Author: Starvoxel AI Agent - 2026-11-05
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

using Avalonia.Controls;
using Avalonia.Controls.Templates;

using Closeout.Desktop.ViewModels;

namespace Closeout.Desktop;

/// <summary>
/// Resolves a view for a view-model from an explicit registration table. It uses no reflection, so it
/// stays safe under trimming.
/// </summary>
public sealed class ViewLocator : IDataTemplate
{
    #region Fields

    private static readonly Dictionary<Type, Func<Control>> Registrations = new()
    {
        // Register each view-model and its view here: [typeof(FooViewModel)] = () => new FooView(),
    };

    #endregion

    #region Public Methods

    /// <summary>
    /// Creates the view registered for the given view-model.
    /// </summary>
    /// <param name="param">The view-model instance.</param>
    /// <returns>The view, or a placeholder naming the missing registration.</returns>
    public Control? Build(object? param)
    {
        if (param is null)
        {
            return null;
        }

        if (Registrations.TryGetValue(param.GetType(), out Func<Control>? factory))
        {
            return factory();
        }

        return new TextBlock { Text = $"No view registered for {param.GetType().Name}" };
    }

    /// <summary>
    /// Reports whether this locator handles the given data.
    /// </summary>
    /// <param name="data">The data to match.</param>
    /// <returns>True when the data is a view-model.</returns>
    public bool Match(object? data) => data is ViewModelBase;

    #endregion
}
