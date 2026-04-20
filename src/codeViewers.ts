import {
    // CodeMirrorEditorFactory,
    // CodeMirrorMimeTypeService,
    EditorLanguageRegistry,
    CodeMirrorEditorFactory,
    EditorThemeRegistry,
    EditorExtensionRegistry,
    // CodeMirrorMimeTypeService,
} from '@jupyterlab/codemirror';
import { CodeEditorWrapper } from '@jupyterlab/codeeditor';
import {
    // Cell, CodeCell, 
    CodeCellModel
} from '@jupyterlab/cells';
import { nodState } from "./state";
import {
    NotebookPanel,
    INotebookModel
} from '@jupyterlab/notebook';
import { Widget } from '@lumino/widgets';
import { IDisposable, DisposableDelegate } from '@lumino/disposable';
import { DocumentRegistry } from '@jupyterlab/docregistry';
// const INPUT_AREA_CLASS = 'jp-InputArea';
// const INPUT_AREA_EDITOR_CLASS = 'jp-InputArea-editor';
const NOD_VIEWER_CLASS = 'jp-nod-viewer'
const NOD_HEADER_CLASS = 'jp-nod-Header'
const NOD_FOOTER_CLASS = 'jp-nod-Footer'
const NOD_FUNC_CLASS = 'jp-nod-Function'
export class CodeViewers implements DocumentRegistry.IWidgetExtension<
    NotebookPanel,
    INotebookModel
> {
    /**
     * Create a new extension object.
     */
    createNew(
        panel: NotebookPanel,
        context: DocumentRegistry.IContext<INotebookModel>
    ): IDisposable {

        const header = makeCodeViewer(panel, NOD_HEADER_CLASS);
        const func = makeCodeViewer(panel, NOD_FUNC_CLASS);
        const footer = makeCodeViewer(panel, NOD_FOOTER_CLASS);

        panel.revealed.then(() => {
            if (nodState.Instance().isMainFile(panel)) {
                const innerPanel = panel.node.getElementsByClassName('jp-WindowedPanel-inner')[0] as HTMLElement;
                const parentNode = innerPanel.parentElement
                if (parentNode) {
                    Widget.attach(header, parentNode, innerPanel)
                    Widget.attach(func, parentNode, innerPanel)
                    Widget.attach(footer, parentNode)
                }
            }
        })
        return new DisposableDelegate(() => {
            header.dispose()
            footer.dispose()
            func.dispose()
        });
    }
}
export function makeCodeViewer(panel: NotebookPanel, className: 'jp-nod-Footer' | 'jp-nod-Header' | 'jp-nod-Function') {
    let source = ""
    let editor
    const currentFrame = nodState.Instance().currentFrame
    switch (className) {
        case NOD_HEADER_CLASS:
            source = currentFrame.text_above.join('').split('\\n').join('\n')
        case NOD_FOOTER_CLASS:
            source = currentFrame.text_below.join('').split('\\n').join('\n')
            if (source.startsWith('\n')) {
                source = source.slice(source.indexOf('\n'))
            }
            editor = makeCodeViewerWidget(className, source)
            return editor
        case NOD_FUNC_CLASS:
            source = currentFrame.text_header.join('').split('\\n').join('\n')
            if (source.endsWith('\n')) {
                source = source.slice(0, source.lastIndexOf('\n'))
            }
            editor = makeCodeViewerWidget(className, source)
            return editor
    }
}

export function makeCodeViewerWidget(className: string, source: string): CodeEditorWrapper {

    const model = new CodeCellModel()
    model.mimeType = 'text/x-python'
    model.sharedModel.setSource(source)
    const languages = new EditorLanguageRegistry();
    EditorLanguageRegistry.getDefaultLanguages()
        .filter(language =>
            ['python'].includes(language.name.toLowerCase())
        )
        .forEach(language => {
            languages.addLanguage(language);
        });
    const themes = new EditorThemeRegistry();
    EditorThemeRegistry.getDefaultThemes().forEach(theme => {
        themes.addTheme(theme);
    });
    const registry = new EditorExtensionRegistry();

    EditorExtensionRegistry.getDefaultExtensions({ themes }).forEach(
        extensionFactory => {
            registry.addExtension(extensionFactory);
        }
    );
    const factoryService = new CodeMirrorEditorFactory({
        extensions: registry,
        languages
    });
    const service = factoryService.newInlineEditor.bind(factoryService)
    const editor = new CodeEditorWrapper({
        factory: service,
        model: model,
        editorOptions: {
            config: {
                readOnly: true,
                lineNumbers: false
            }
        },
    });
    // editor.addClass(INPUT_AREA_CLASS);
    // editor.addClass(INPUT_AREA_EDITOR_CLASS);
    editor.addClass(NOD_VIEWER_CLASS)
    editor.addClass(className)
    return editor
}
