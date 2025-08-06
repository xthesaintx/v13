// Fixed DescriptionEditor with proper v13 action handlers

// v13 ApplicationV2 imports
const { HandlebarsApplicationMixin } = foundry.applications.api;
// const { ApplicationV2 } = foundry.applications.api;
const { DialogV2} =foundry.applications.api;

export class DescriptionEditor extends HandlebarsApplicationMixin(DialogV2) {
  constructor(options = {}) {
    super(options);
    this.fieldName = options.field;
  }

  static DEFAULT_OPTIONS = {
    classes: ["dialog", "journal-editor", "sheet", "journal-sheet", "journal-entry", "journal-entry-page", "text", "cc-editor", "themed"],
    tag: "dialog",
    position: {
      width: 720,
      height: 600
    },
    window: {
      title: "Edit Description",
      resizable: true,
      frame: true,
      minimizable: false,
      closeOnSubmit: true,
    },
    buttons: [
      {
        action: "save",
        icon: '<i class="far fa-save"></i>',
        label: "Save Changes",
        default: true,
        callback: (event, button, dialog) => dialog.submit(),
      },
      {
        action: "cancel",
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel",
        callback: (event, button, dialog) => dialog.close(),
      }
    ],
  };

  static PARTS = {
    content: {
      template: "modules/campaign-codex/templates/editors/description-editor.html"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const dataPath = `flags.campaign-codex.data.${this.fieldName}`;
    context.description = foundry.utils.getProperty(this.document, dataPath) || "";
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this._setupProseMirrorEditor();
  }

  async _setupProseMirrorEditor() {
    const targetElement = this.element.querySelector('div[name="description"]');
    if (!targetElement) {
      console.error('DescriptionEditor: Could not find description target element');
      return;
    }
    const dataPath = `flags.campaign-codex.data.${this.fieldName}`;
    const content = foundry.utils.getProperty(this.document, dataPath) || "";
    const plugins = {
      menu: ProseMirror.ProseMirrorMenu.build(ProseMirror.defaultSchema, {
        compact: true,
        destroyOnSave: false,
        onSave: () => this.submit(),
      })
    };
    try {
      this.editor = await foundry.applications.ux.TextEditor.implementation.create({
        target: targetElement,
        engine: "prosemirror",
        plugins: plugins
      }, content);
    } catch (error) {
      console.error('DescriptionEditor: Failed to create ProseMirror editor:', error);
    }
  }

  async _onSubmitForm(event, form, formData) {
    event.preventDefault();
    await this._updateObject(event, formData);
  }

  async _updateObject(event, formData) {
    const contentElement = this.element.querySelector('div[name="description"]');
    if (!contentElement) {
      console.error('DescriptionEditor: Could not find description content element');
      return;
    }
    const newContent = contentElement.innerHTML;
    const dataPath = `flags.campaign-codex.data.${this.fieldName}`;
    try {
      await this.document.update({
        [dataPath]: newContent
      });
      if (this.document.sheet) {
        this.document.sheet.render(true);
      }
    } catch (error) {
      console.error('DescriptionEditor: Failed to update document:', error);
      ui.notifications.error("Failed to save changes");
    }
  }

  async close(options = {}) {
    if (this.editor && typeof this.editor.destroy === 'function') {
      try {
        this.editor.destroy();
      } catch (error) {
        console.warn('DescriptionEditor: Error destroying editor:', error);
      }
      this.editor = null;
    }
    return super.close(options);
  }

  async submit(options = {}) {
    if (this.editor && typeof this.editor.save === 'function') {
      try {
        await this.editor.save();
      } catch (error) {
        console.warn('DescriptionEditor: Error saving editor content:', error);
      }
    }
    await this._updateObject();
    return super.submit(options);
  }

  async render(force = false, options = {}) {
    try {
      return await super.render(force, options);
    } catch (error) {
      console.error('DescriptionEditor: Error rendering editor:', error);
      ui.notifications.error("Failed to open description editor");
      throw error;
    }
  }
}