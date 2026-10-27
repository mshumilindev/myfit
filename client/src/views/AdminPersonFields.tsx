import { Field } from '../components/ui/Field';
import { useT } from '../i18n';

/** First name · last name · username, the same three fields in "New" and "Edit". */
export function PersonFields(props: {
  firstName: string;
  lastName: string;
  username: string;
  onFirstName: (v: string) => void;
  onLastName: (v: string) => void;
  onUsername: (v: string) => void;
}) {
  const { t } = useT();
  return (
    <>
      <Field
        placeholder={t.firstName}
        value={props.firstName}
        onChange={(e) => props.onFirstName(e.target.value)}
      />
      <Field
        placeholder={t.lastName}
        value={props.lastName}
        onChange={(e) => props.onLastName(e.target.value)}
      />
      <Field
        placeholder={t.username}
        value={props.username}
        onChange={(e) => props.onUsername(e.target.value)}
      />
    </>
  );
}
