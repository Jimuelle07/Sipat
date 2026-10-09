import { defineStrings } from '../i18n';

/**
 * Copy for the Family tab, the member editor and the area picker. Chip labels for
 * relations, age groups, needs and home tags live in commonStrings.
 */
export const profileStrings = defineStrings({
  tl: {
    screenTitle: 'Pamilya',
    back: 'Bumalik',
    noHousehold: 'Wala pang sambahayan',
    noHouseholdBody: 'Gumawa muna ng sambahayan para makilala ang pamilya kung sakaling mawalay.',

    householdTitle: 'Sambahayan',
    save: 'I-save',
    saving: 'Ini-save…',
    saved: 'Na-save.',

    membersTitle: 'Mga miyembro',
    memberAvatar: 'Litrato ng miyembro',
    memberPhoto: 'Litrato',
    findMember: 'Hinahanap',
    addMemberBody: 'Idagdag lahat ng kasama sa bahay, may litrato man o wala.',

    photoTitle: 'Litrato ng mukha',
    changePhoto: 'Palitan ang litrato',
    removePhoto: 'Alisin ang litrato',

    memberAddTitle: 'Bagong miyembro',
    memberEditTitle: 'I-edit ang miyembro',
    memberNote: 'Tala (opsyonal)',
    memberPhone: 'Telepono (opsyonal)',
    saveMember: 'I-save ang miyembro',
    removeMember: 'Alisin ang miyembro',

    removeHousehold: 'Alisin ang sambahayan',
    removeHouseholdBody: 'Mabubura ang sambahayan, ang mga miyembro at ang kanilang mga litrato sa teleponong ito. Hindi na ito maibabalik.',
    confirmRemove: 'Alisin na',
    cancel: 'Kanselahin',

    areaTitle: 'Lugar ng tirahan',
    areaCurrent: 'Kasalukuyang lugar',
    areaNone: 'Wala pang nakatalang lugar.',
    areaChoose: 'Piliin ang lugar',
    areaRoot: 'Buong bansa',
    areaBack: 'Bumalik sa nakaraang antas',
    areaNoPlaces: 'Walang lugar sa antas na ito.',
    areaDrillHint: 'Buksan ang mas maliit na lugar',

    settingsLink: 'Mga setting',
    accountLink: 'Account',
    linksTitle: 'Iba pang mga screen',
  },
  en: {
    screenTitle: 'Family',
    back: 'Back',
    noHousehold: 'No household yet',
    noHouseholdBody: 'Create a household first so your family can be identified if you get separated.',

    householdTitle: 'Household',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved.',

    membersTitle: 'Members',
    memberAvatar: 'Member photo',
    memberPhoto: 'Photo',
    findMember: 'Missing',
    addMemberBody: 'Add everyone in the home, with or without a photo.',

    photoTitle: 'Face photo',
    changePhoto: 'Replace photo',
    removePhoto: 'Remove photo',

    memberAddTitle: 'New member',
    memberEditTitle: 'Edit member',
    memberNote: 'Note (optional)',
    memberPhone: 'Phone (optional)',
    saveMember: 'Save member',
    removeMember: 'Remove member',

    removeHousehold: 'Remove household',
    removeHouseholdBody: 'The household, its members and their photos on this phone will be erased. This cannot be undone.',
    confirmRemove: 'Remove now',
    cancel: 'Cancel',

    areaTitle: 'Home area',
    areaCurrent: 'Current area',
    areaNone: 'No area is saved yet.',
    areaChoose: 'Choose an area',
    areaRoot: 'Whole country',
    areaBack: 'Back to the previous level',
    areaNoPlaces: 'No places at this level.',
    areaDrillHint: 'Open the smaller area',

    settingsLink: 'Settings',
    accountLink: 'Account',
    linksTitle: 'Other screens',
  },
});
