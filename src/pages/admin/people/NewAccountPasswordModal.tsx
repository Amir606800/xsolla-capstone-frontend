import { Modal } from '../../../components/Modal'
import { PasswordHandover } from './PasswordHandover'

/** An account the admin just made: what to hand over to its owner. */
export interface CreatedAccount {
  name: string
  email: string
  password: string
}

/**
 * Admin: the second dialog after "Add student / mentor / lecturer". The password was typed or generated in the first one;
 * this shows it once more with a Copy button, like after a password reset, so it can be handed over. Closing it any way
 * (Done, Esc, outside) ends it: the password is not kept anywhere.
 */
export function NewAccountPasswordModal({ created, onDone }: { created: CreatedAccount | null; onDone: () => void }) {
  return (
    <Modal open={created !== null} onClose={onDone} title={created ? `${created.name}’s password` : ''} size="sm" initialFocus=".admin-dialog .admin-btn">
      {created && (
        <PasswordHandover
          name={created.name}
          label="Password"
          headline={`${created.name}’s account has been created.`}
          hint={`They sign in with ${created.email} and this password. Give it to them in person or in a private message. This is the last time it is shown.`}
          password={created.password}
          onDone={onDone}
        />
      )}
    </Modal>
  )
}
