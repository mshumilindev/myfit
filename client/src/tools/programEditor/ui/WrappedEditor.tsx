import { ProgramEditor as Editor, type ProgramEditorProps } from './ProgramEditor';

/**
 * The editor as hosts mount it. A host may wrap it (`host.slots.wrap`) to edit another view of the same document, a week of a
 * cycle; the editor's undo history then belongs to that view.
 */
export function ProgramEditor(props: ProgramEditorProps) {
  const Wrap = props.host.slots?.wrap;
  if (!Wrap) return <Editor {...props} />;
  return (
    <Wrap doc={props.doc} onChange={props.onChange} readOnly={!!props.readOnly}>
      {(doc, onChange) => <Editor {...props} doc={doc} onChange={onChange} />}
    </Wrap>
  );
}
