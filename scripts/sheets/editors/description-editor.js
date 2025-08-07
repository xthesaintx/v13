export class DescriptionEditor extends FormApplication {

  constructor(document, options) {
    super(document, options);
    this.document = document; 
    this.fieldName = options.field;

  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: "Edit Description",
      template: "modules/campaign-codex/templates/editors/description-editor.html",
      width: 720,
      height: 600,
      resizable: true,
      classes: ["dialog", "journal-editor", "sheet", "journal-sheet", "journal-entry", "journal-entry-page", "text" ,"cc-editor"],
      closeOnSubmit: true, 
    });
  }

 

  activateListeners(html) {
  const nativeHtml = html instanceof jQuery ? html[0] : html;
  super.activateListeners(html);

  const targetElement = nativeHtml.querySelector('div[name="description"]');

  const dataPath = `flags.campaign-codex.data.${this.fieldName}`;
  const content = foundry.utils.getProperty(this.object, dataPath) || "";

  const plugins = {
    menu: ProseMirror.ProseMirrorMenu.build(ProseMirror.defaultSchema, {
      compact: true,      
      destroyOnSave: true, 
      onSave: () => {
        this.submit();
      }
    })
  };



  TextEditor.create({
    target: targetElement,
    engine: "prosemirror",
    plugins: plugins
  }, content).then(editor => {
    this.editor = editor;
  });
}


  async _updateObject(event, formData) {
    const fnamed = this.fieldName;
    const newContent = this.element[0].querySelector('div[name="description"]').innerHTML;
    const dataPath = 'flags.campaign-codex.data.'+fnamed;
    await this.document.update({
      [dataPath]: newContent
    });
    
    this.document.sheet.render(true);
  }


  async close(options = {}) {
    if (this.editor && typeof this.editor.destroy === 'function') {
      this.editor.destroy();
    }
    return super.close(options);
  }
}