// v13 ApplicationV2 imports
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 } = foundry.applications.api;

export class DescriptionEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.fieldName = options.field;
  }

  // v13: Replace defaultOptions() with DEFAULT_OPTIONS static field
  static DEFAULT_OPTIONS = {
    classes: ["dialog", "journal-editor", "sheet", "journal-sheet", "journal-entry", "journal-entry-page", "text", "cc-editor", "themed"],
    tag: "form", // Required for form functionality
    position: { 
      width: 720, 
      height: 600 
    },
    window: {
      title: "Edit Description",
      resizable: true
    },
    form: {
      handler: DescriptionEditor.#onSubmitForm,
      closeOnSubmit: true,
      submitOnChange: false
    }
  };

  // v13: Define template parts
  static PARTS = {
    form: {
      template: "modules/campaign-codex/templates/editors/description-editor.html"
    }
  };

  // v13: Replace getData() with _prepareContext()
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    
    // Get the content from the document
    const dataPath = `flags.campaign-codex.data.${this.fieldName}`;
    context.description = foundry.utils.getProperty(this.document, dataPath) || "";
    
    return context;
  }

  // v13: Replace activateListeners with _onRender for ProseMirror setup
  _onRender(context, options) {
    super._onRender(context, options);
    this._setupProseMirrorEditor();
  }

  // v13: Convert jQuery ProseMirror setup to vanilla JavaScript
  async _setupProseMirrorEditor() {
    // Find the target element using vanilla JavaScript
    const targetElement = this.element.querySelector('div[name="description"]');
    
    if (!targetElement) {
      console.error('DescriptionEditor: Could not find description target element');
      return;
    }

    // Get the content from the document
    const dataPath = `flags.campaign-codex.data.${this.fieldName}`;
    const content = foundry.utils.getProperty(this.document, dataPath) || "";

    // Configure ProseMirror plugins
    const plugins = {
      menu: ProseMirror.ProseMirrorMenu.build(ProseMirror.defaultSchema, {
        compact: true,      // Makes the menu smaller
        destroyOnSave: true, // The menu will disappear after saving
        onSave: () => {
          // When the save button in the menu is clicked, submit the form
          this.submit();
        }
      })
    };

    try {
      // Create the ProseMirror editor
      this.editor = await TextEditor.create({
        target: targetElement,
        engine: "prosemirror",
        plugins: plugins
      }, content);
    } catch (error) {
      console.error('DescriptionEditor: Failed to create ProseMirror editor:', error);
    }
  }

  // v13: Static form handler method
  static async #onSubmitForm(event, form, formData) {
    event.preventDefault();
    await this._updateObject(event, formData);
  }

  // v13: Convert jQuery-based content extraction to vanilla JavaScript
  async _updateObject(event, formData) {
    // Get the latest content from the editor's div in the form using vanilla JavaScript
    const contentElement = this.element.querySelector('div[name="description"]');
    
    if (!contentElement) {
      console.error('DescriptionEditor: Could not find description content element');
      return;
    }

    const newContent = contentElement.innerHTML;
    const dataPath = `flags.campaign-codex.data.${this.fieldName}`;
    
    try {
      // Update the document flag
      await this.document.update({
        [dataPath]: newContent
      });
      
      // Re-render the parent sheet to show the changes
      if (this.document.sheet) {
        this.document.sheet.render(true);
      }
    } catch (error) {
      console.error('DescriptionEditor: Failed to update document:', error);
      ui.notifications.error("Failed to save changes");
    }
  }

  // v13: Enhanced close method with proper editor cleanup
  async close(options = {}) {
    // Clean up ProseMirror editor
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

  // v13: Override submit to handle ProseMirror content properly
  async submit(options = {}) {
    // Ensure ProseMirror content is synced before submission
    if (this.editor && typeof this.editor.save === 'function') {
      try {
        await this.editor.save();
      } catch (error) {
        console.warn('DescriptionEditor: Error saving editor content:', error);
      }
    }
    
    return super.submit(options);
  }

  // v13: Add error handling for editor initialization
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
