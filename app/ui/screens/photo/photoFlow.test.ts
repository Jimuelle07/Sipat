import { describe, expect, it } from 'vitest';
import type { CropRect, FaceDetection, MemberPhoto, PhotoDraft, PhotoError, Result } from '../../../engine';
import type { PhotoAction, PhotoFlow, PhotoNotice, PhotoStep } from './photoFlow';
import { INITIAL_PHOTO_FLOW, draftIdToDiscard, isManual, photoReducer } from './photoFlow';

function pass<T>(value: T): Result<T, PhotoError> {
  return { ok: true, value };
}

function fail(code: PhotoError): Result<never, PhotoError> {
  return { ok: false, error: { code, message: code } };
}

const SUGGESTED: CropRect = { x: 0.1, y: 0.1, width: 0.6, height: 0.6 };
const ADJUSTED: CropRect = { x: 0.2, y: 0.25, width: 0.5, height: 0.5 };

function makeDraft(detection: FaceDetection = 'one_face'): PhotoDraft {
  return {
    draftId: 'draft-1',
    memberId: 'member-1',
    previewUri: 'file:///preview-1.jpg',
    detection,
    faces: [],
    suggestedCrop: SUGGESTED,
    expiresAt: '2026-10-10T12:30:00+08:00',
  };
}

const DRAFT = makeDraft('one_face');

const PHOTO: MemberPhoto = {
  uri: 'file:///photos/member-1.jpg',
  bytes: 120000,
  source: 'camera',
  faceCheck: 'one_face',
  takenAt: '2026-10-10T12:00:00+08:00',
  version: 1,
};

const CHOOSE: PhotoStep = { step: 'choose' };
const STARTING: PhotoStep = { step: 'starting', source: 'camera' };
const CROP: PhotoStep = { step: 'crop', draft: DRAFT, crop: SUGGESTED, manual: false };
const CROP_MANUAL: PhotoStep = { step: 'crop', draft: DRAFT, crop: SUGGESTED, manual: true };
const CONFIRM: PhotoStep = { step: 'confirm', draft: DRAFT, crop: SUGGESTED };
const SAVING: PhotoStep = { step: 'saving', draft: DRAFT, crop: SUGGESTED, manual: false };
const SAVING_MANUAL: PhotoStep = { step: 'saving', draft: DRAFT, crop: SUGGESTED, manual: true };
const DONE: PhotoStep = { step: 'done', photo: PHOTO };
const CLOSED: PhotoStep = { step: 'closed' };

const PHOTO_ERRORS: PhotoError[] = [
  'permission_denied',
  'no_camera',
  'unreadable',
  'draft_expired',
  'not_found',
  'io',
];
const SAVED_OTHER_ERRORS: PhotoError[] = ['permission_denied', 'no_camera', 'unreadable', 'not_found', 'io'];

function flowWith(current: PhotoStep, notice: PhotoNotice | null = null): PhotoFlow {
  return { current, notice };
}

describe('INITIAL_PHOTO_FLOW', () => {
  it('starts on the choose step with no notice', () => {
    expect(INITIAL_PHOTO_FLOW).toEqual({ current: { step: 'choose' }, notice: null });
  });
});

describe('photoReducer pick', () => {
  it.each(['camera', 'gallery'] as const)('pick from choose starts the %s and clears the notice', (source) => {
    const flow = flowWith(CHOOSE, { source: 'photo', code: 'io' });
    expect(photoReducer(flow, { type: 'pick', source })).toEqual({
      current: { step: 'starting', source },
      notice: null,
    });
  });
});

describe('photoReducer started', () => {
  it.each(['camera', 'gallery'] as const)(
    'started from %s with null (the user backed out) returns to choose with no notice',
    (source) => {
      const flow = flowWith({ step: 'starting', source });
      expect(photoReducer(flow, { type: 'started', result: pass(null) })).toEqual({
        current: { step: 'choose' },
        notice: null,
      });
    },
  );

  it('started with a one-face draft goes to crop with the suggested crop, not manual and no notice', () => {
    const flow = flowWith(STARTING);
    const draft = makeDraft('one_face');
    expect(photoReducer(flow, { type: 'started', result: pass(draft) })).toEqual({
      current: { step: 'crop', draft, crop: draft.suggestedCrop, manual: false },
      notice: null,
    });
  });

  it.each(['no_face', 'many_faces', 'unavailable'] as const)(
    'started with a %s draft goes to manual crop with a face_detection notice',
    (detection) => {
      const flow = flowWith(STARTING);
      const draft = makeDraft(detection);
      expect(photoReducer(flow, { type: 'started', result: pass(draft) })).toEqual({
        current: { step: 'crop', draft, crop: draft.suggestedCrop, manual: true },
        notice: { source: 'face_detection', code: detection },
      });
    },
  );

  it.each(PHOTO_ERRORS)('started error %s returns to choose with a photo notice', (code) => {
    const flow = flowWith(STARTING);
    expect(photoReducer(flow, { type: 'started', result: fail(code) })).toEqual({
      current: { step: 'choose' },
      notice: { source: 'photo', code },
    });
  });
});

describe('photoReducer adjust', () => {
  it('adjust in crop replaces the crop rect and keeps the draft and manual flag', () => {
    const flow = flowWith(CROP_MANUAL);
    expect(photoReducer(flow, { type: 'adjust', crop: ADJUSTED }).current).toEqual({
      step: 'crop',
      draft: DRAFT,
      crop: ADJUSTED,
      manual: true,
    });
  });
});

describe('photoReducer accept', () => {
  it('accept on an automatic crop goes straight to saving as not manual', () => {
    const flow = flowWith(CROP);
    expect(photoReducer(flow, { type: 'accept' }).current).toEqual({
      step: 'saving',
      draft: DRAFT,
      crop: SUGGESTED,
      manual: false,
    });
  });

  it('accept on a manual crop goes to confirm', () => {
    const flow = flowWith(CROP_MANUAL);
    expect(photoReducer(flow, { type: 'accept' }).current).toEqual({
      step: 'confirm',
      draft: DRAFT,
      crop: SUGGESTED,
    });
  });
});

describe('photoReducer confirm', () => {
  it('confirm yes goes to saving as manual', () => {
    const flow = flowWith(CONFIRM);
    expect(photoReducer(flow, { type: 'confirm', yes: true }).current).toEqual({
      step: 'saving',
      draft: DRAFT,
      crop: SUGGESTED,
      manual: true,
    });
  });

  it('confirm no returns to choose and clears the notice', () => {
    const flow = flowWith(CONFIRM, { source: 'face_detection', code: 'many_faces' });
    expect(photoReducer(flow, { type: 'confirm', yes: false })).toEqual({
      current: { step: 'choose' },
      notice: null,
    });
  });
});

describe('photoReducer saved', () => {
  it('saved ok in saving goes to done with the photo', () => {
    const flow = flowWith(SAVING);
    expect(photoReducer(flow, { type: 'saved', result: pass(PHOTO) }).current).toEqual({
      step: 'done',
      photo: PHOTO,
    });
  });

  it('saved error draft_expired returns to choose with a photo notice', () => {
    const flow = flowWith(SAVING_MANUAL);
    expect(photoReducer(flow, { type: 'saved', result: fail('draft_expired') })).toEqual({
      current: { step: 'choose' },
      notice: { source: 'photo', code: 'draft_expired' },
    });
  });

  it.each(SAVED_OTHER_ERRORS)(
    'saved error %s returns to crop with the same draft, crop and manual flag and a photo notice',
    (code) => {
      const flow = flowWith(SAVING_MANUAL);
      expect(photoReducer(flow, { type: 'saved', result: fail(code) })).toEqual({
        current: { step: 'crop', draft: DRAFT, crop: SUGGESTED, manual: true },
        notice: { source: 'photo', code },
      });
    },
  );
});

describe('photoReducer later', () => {
  const STEPS: Array<[string, PhotoStep]> = [
    ['choose', CHOOSE],
    ['starting', STARTING],
    ['crop', CROP],
    ['confirm', CONFIRM],
    ['saving', SAVING],
    ['closed', CLOSED],
  ];

  it.each(STEPS)('later from the %s step closes the flow without a photo', (_name, step) => {
    const flow = flowWith(step);
    expect(photoReducer(flow, { type: 'later' }).current).toEqual({ step: 'closed' });
  });

  it('later from done is ignored', () => {
    const flow = flowWith(DONE);
    expect(photoReducer(flow, { type: 'later' })).toEqual(flow);
  });

  it('has no skip action: an unknown action leaves the flow unchanged', () => {
    const flow = flowWith(CROP);
    const unknown = { type: 'skip' } as unknown as PhotoAction;
    expect(photoReducer(flow, unknown)).toEqual(flow);
  });
});

describe('photoReducer actions that do not apply', () => {
  const NOT_APPLICABLE: Array<[string, PhotoStep, PhotoAction]> = [
    ['pick outside choose', STARTING, { type: 'pick', source: 'gallery' }],
    ['started outside starting', CHOOSE, { type: 'started', result: pass(DRAFT) }],
    ['adjust outside crop', CONFIRM, { type: 'adjust', crop: ADJUSTED }],
    ['accept outside crop', CHOOSE, { type: 'accept' }],
    ['confirm outside confirm', CROP, { type: 'confirm', yes: true }],
    ['saved outside saving', CROP, { type: 'saved', result: pass(PHOTO) }],
  ];

  it.each(NOT_APPLICABLE)('ignores %s and returns the flow unchanged', (_name, step, action) => {
    const flow = flowWith(step, { source: 'photo', code: 'io' });
    expect(photoReducer(flow, action)).toEqual(flow);
  });
});

describe('draftIdToDiscard', () => {
  const CASES: Array<[string, PhotoStep, string | null]> = [
    ['choose', CHOOSE, null],
    ['starting', STARTING, null],
    ['crop', CROP, 'draft-1'],
    ['confirm', CONFIRM, 'draft-1'],
    ['saving', SAVING, 'draft-1'],
    ['done', DONE, null],
    ['closed', CLOSED, null],
  ];

  it.each(CASES)('on the %s step returns %s', (_name, step, expected) => {
    expect(draftIdToDiscard(flowWith(step))).toBe(expected);
  });
});

describe('isManual', () => {
  const CASES: Array<[FaceDetection, boolean]> = [
    ['one_face', false],
    ['no_face', true],
    ['many_faces', true],
    ['unavailable', true],
  ];

  it.each(CASES)('isManual(%s) is %s', (detection, expected) => {
    expect(isManual(detection)).toBe(expected);
  });
});
