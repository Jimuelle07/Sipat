import { defineStrings } from '../i18n';

/**
 * Copy for the first-run setup wizard: household and main person, the required owner
 * photo, the member list, the home area and the closing statement.
 */
export const setupStrings = defineStrings({
  tl: {
    screenTitle: 'Paghahanda',
    intro: 'Kilalanin ang pamilya mo sa limang hakbang, kahit walang signal.',
    continue: 'Magpatuloy',
    back: 'Bumalik',
    later: 'Mamaya na',
    skip: 'Laktawan muna',
    progressLabel: 'Hakbang',

    householdTitle: 'Sambahayan at pangunahing tao',
    householdBody: 'Pangalanan ang sambahayan at ang pangunahing taong mag-aasikaso nito.',

    ownerPhotoTitle: 'Litrato ng pangunahing tao',
    ownerPhotoBody: 'Kailangan ng bawat miyembro ang litrato ng mukha. Puwede itong idagdag mamaya.',

    membersTitle: 'Mga miyembro ng pamilya',
    membersBody: 'Idagdag ang lahat ng kasama sa bahay. Maaaring kunan ng litrato ang bawat isa mamaya.',

    areaTitle: 'Lugar ng tirahan',
    areaBody: 'Piliin ang barangay para makuha ang tamang gabay at mga babala.',

    doneTitle: 'Handa na ang sambahayan',
    doneBody: 'Puwede ka nang magtanong, gumawa ng checklist, at tingnan ang mga babala para sa pamilya.',
    start: 'Pumasok sa Bagyo Buddy',

    takePhoto: 'Kunan ng litrato',
    addMember: 'Magdagdag ng miyembro',
    phoneOptional: 'Telepono (opsyonal)',
    photoPending: 'Kulang pa ang litrato',
  },
  en: {
    screenTitle: 'Set up',
    intro: 'Let the app know your family in five steps, even without signal.',
    continue: 'Continue',
    back: 'Back',
    later: 'Later',
    skip: 'Skip for now',
    progressLabel: 'Step',

    householdTitle: 'Household and main person',
    householdBody: 'Name the home, then the main person who will speak for the family.',

    ownerPhotoTitle: "Main person's photo",
    ownerPhotoBody: 'Every member has a face photo. You can change it any time, so later is fine.',

    membersTitle: 'Family members',
    membersBody: 'Add everyone in the home. Add each one a photo later.',

    areaTitle: 'Home area',
    areaBody: 'Choose the barangay so the app can give the right guide and warnings.',

    doneTitle: 'The household is ready',
    doneBody: 'You can now ask questions, build a checklist and see warnings for your family.',
    start: 'Go to Bagyo Buddy',

    takePhoto: 'Take a photo',
    addMember: 'Add member',
    phoneOptional: 'Phone (optional)',
    photoPending: 'Photo still needed',
  },
});
