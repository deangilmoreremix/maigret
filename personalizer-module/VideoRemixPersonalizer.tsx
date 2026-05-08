import { useState } from 'react';
import PersonalizerDialog from './PersonalizerDialog';

interface VideoRemixPersonalizerProps {
  appId?: string;
  mode?: string;
  userId?: string;
  projectId?: string;
  defaultOffer?: string;
  defaultGoal?: string;
  defaultTone?: string;
  defaultCTA?: string;
  initialTarget?: string;
  onComplete?: (output: any) => void;
  onSave?: (projectId: string) => void;
  onClose?: () => void;
  theme?: any;
}

export default function VideoRemixPersonalizer({
  appId,
  mode,
  userId,
  projectId,
  defaultOffer,
  defaultGoal,
  defaultTone,
  defaultCTA,
  initialTarget,
  onComplete,
  onSave,
  onClose,
  theme
}: VideoRemixPersonalizerProps) {
  const [open, setOpen] = useState(false);

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white"
      >
        Personalize This
      </button>
      <PersonalizerDialog
        open={open}
        onClose={handleClose}
        appId={appId}
        mode={mode}
        userId={userId}
        projectId={projectId}
        defaultOffer={defaultOffer}
        defaultGoal={defaultGoal}
        defaultTone={defaultTone}
        defaultCTA={defaultCTA}
        initialTarget={initialTarget}
        onComplete={onComplete}
        onSave={onSave}
        theme={theme}
      />
    </>
  );
}
