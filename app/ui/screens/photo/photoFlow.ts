import type {
  CropRect,
  FaceDetection,
  MemberPhoto,
  PhotoDraft,
  PhotoError,
  Result,
} from '../../../engine';

export type PhotoStep =
  | { step: 'choose' }
  | { step: 'starting'; source: 'camera' | 'gallery' }
  | { step: 'crop'; draft: PhotoDraft; crop: CropRect; manual: boolean }
  | { step: 'confirm'; draft: PhotoDraft; crop: CropRect }
  | { step: 'saving'; draft: PhotoDraft; crop: CropRect; manual: boolean }
  | { step: 'done'; photo: MemberPhoto }
  | { step: 'closed' };

export interface PhotoNotice {
  source: 'photo' | 'face_detection';
  code: string;
}

export interface PhotoFlow {
  current: PhotoStep;
  notice: PhotoNotice | null;
}

export type PhotoAction =
  | { type: 'pick'; source: 'camera' | 'gallery' }
  | { type: 'started'; result: Result<PhotoDraft | null, PhotoError> }
  | { type: 'adjust'; crop: CropRect }
  | { type: 'accept' }
  | { type: 'confirm'; yes: boolean }
  | { type: 'saved'; result: Result<MemberPhoto, PhotoError> }
  | { type: 'later' };

export const INITIAL_PHOTO_FLOW: PhotoFlow = {
  current: { step: 'choose' },
  notice: null,
};

export function isManual(detection: FaceDetection): boolean {
  return detection !== 'one_face';
}

function flow(current: PhotoStep, notice: PhotoNotice | null = null): PhotoFlow {
  return { current, notice };
}

export function photoReducer(state: PhotoFlow, action: PhotoAction): PhotoFlow {
  const { current } = state;

  switch (action.type) {
    case 'pick':
      if (current.step !== 'choose') return state;
      return flow({ step: 'starting', source: action.source }, null);

    case 'started': {
      if (current.step !== 'starting') return state;
      if (!action.result.ok) {
        return flow({ step: 'choose' }, { source: 'photo', code: action.result.error.code });
      }
      const draft = action.result.value;
      if (draft === null) return flow({ step: 'choose' }, null);
      const manual = isManual(draft.detection);
      return flow(
        { step: 'crop', draft, crop: draft.suggestedCrop, manual },
        manual ? { source: 'face_detection', code: draft.detection } : null,
      );
    }

    case 'adjust':
      if (current.step !== 'crop') return state;
      return flow({ step: 'crop', draft: current.draft, crop: action.crop, manual: current.manual }, state.notice);

    case 'accept':
      if (current.step !== 'crop') return state;
      if (current.manual) {
        return flow({ step: 'confirm', draft: current.draft, crop: current.crop }, state.notice);
      }
      return flow({ step: 'saving', draft: current.draft, crop: current.crop, manual: false }, state.notice);

    case 'confirm':
      if (current.step !== 'confirm') return state;
      if (action.yes) {
        return flow({ step: 'saving', draft: current.draft, crop: current.crop, manual: true }, state.notice);
      }
      return flow({ step: 'choose' }, null);

    case 'saved': {
      if (current.step !== 'saving') return state;
      if (action.result.ok) {
        return flow({ step: 'done', photo: action.result.value }, state.notice);
      }
      const code = action.result.error.code;
      if (code === 'draft_expired') {
        return flow({ step: 'choose' }, { source: 'photo', code });
      }
      return flow(
        { step: 'crop', draft: current.draft, crop: current.crop, manual: current.manual },
        { source: 'photo', code },
      );
    }

    case 'later':
      if (current.step === 'done') return state;
      return flow({ step: 'closed' });

    default:
      return state;
  }
}

export function draftIdToDiscard(state: PhotoFlow): string | null {
  switch (state.current.step) {
    case 'crop':
    case 'confirm':
    case 'saving':
      return state.current.draft.draftId;
    default:
      return null;
  }
}
