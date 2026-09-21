import {Dictionary} from './index';

/**
 * Keyed by the English string. A missing entry falls back to that English, so a
 * copy change on the other side of the app degrades to readable rather than broken.
 */
export const uz: Dictionary = {
  // Navigation
  Focus: 'Fokus',
  Apps: 'Ilovalar',
  History: 'Tarix',
  Settings: 'Sozlamalar',

  // Intro
  Loading: 'Yuklanmoqda',
  'Preparing your focus space': 'Fokus maydoningiz tayyorlanmoqda',

  // Home — idle
  'YOUR FOCUS SPACE': 'SIZNING FOKUS MAYDONINGIZ',
  'Protect the next hour.': 'Keyingi soatni himoyalang.',
  'Choose what stays quiet, then let Qoriqchi hold the boundary.':
    "Nima jim turishini tanlang, chegarani Qoriqchi ushlab turadi.",
  'Finish setup': 'Sozlashni tugating',
  'Accessibility access is required before focus can start.':
    'Fokus boshlanishidan oldin Accessibility ruxsati kerak.',
  Distractions: 'Chalg’ituvchilar',
  'Edit list': 'Ro’yxatni tahrirlash',
  'Your block list is ready': 'Bloklash ro’yxati tayyor',
  'Choose apps to block': 'Bloklanadigan ilovalarni tanlang',
  'Choose apps to quiet': 'Jim qilinadigan ilovalarni tanlang',
  'Social, video, games, or anything that pulls you away.':
    'Ijtimoiy tarmoq, video, o\u2019yin \u2014 sizni chalg\u2019itadigan har narsa.',
  'Custom focus duration in minutes': 'Fokus davomiyligi, daqiqada',
  'Choose at least one app to begin.': 'Boshlash uchun kamida bitta ilova tanlang.',
  Duration: 'Davomiyligi',
  'Custom duration': 'O’zingiz belgilang',
  '1 minute to 24 hours': '1 daqiqadan 24 soatgacha',
  'Start time': 'Boshlanish vaqti',
  Optional: 'Ixtiyoriy',
  Now: 'Hozir',
  'READY WHEN YOU ARE': 'TAYYOR BO’LSANGIZ',
  'Ends at {time}': '{time} da tugaydi',
  min: 'daq',
  hour: 'soat',
  hours: 'soat',
  '{n} min': '{n} daq',
  '{n} hr': '{n} soat',
  '{d} of protected time': '{d} himoyalangan vaqt',
  'Start {d} focus': '{d} fokusni boshlash',
  '{n} apps quieted': '{n} ilova jim qilindi',
  '{n} attempts stopped': '{n} urinish to\u2019xtatildi',

  // Home — active
  'Focus active': 'Fokus faol',
  Scheduled: 'Rejalashtirilgan',
  'Not enforcing': 'Ishlamayapti',
  'Stay with the moment.': 'Shu lahzada qoling.',
  'Your session is ready.': 'Sessiyangiz tayyor.',
  'Everything is working. You can safely close this app.':
    'Hammasi ishlayapti. Ilovani bemalol yopishingiz mumkin.',
  'Qoriqchi will begin automatically at the scheduled time.':
    'Qoriqchi belgilangan vaqtda o’zi boshlaydi.',
  'Qoriqchi cannot enforce this session right now.':
    'Qoriqchi hozir bu sessiyani ta’minlay olmayapti.',
  REMAINING: 'QOLDI',
  'STARTS IN': 'BOSHLANADI',
  'ENDS AT': 'TUGAYDI',
  'FOCUS TIMER': 'FOKUS TAYMERI',
  LIVE: 'FAOL',
  'DEEP FOCUS': 'CHUQUR FOKUS',
  'PROTECTED APPS': 'HIMOYADAGI ILOVALAR',
  ON: 'YOQILGAN',
  OFF: 'O\u2019CHIQ',
  'Native protection is on': 'Himoya yoqilgan',
  'Blocking has stopped': 'Bloklash to’xtadi',
  'Blocking continues even when Qoriqchi is closed.':
    'Qoriqchi yopilsa ham bloklash davom etadi.',
  'Accessibility access is off, so blocked apps open normally. Turn it back on to resume this session.':
    'Accessibility o’chirilgan, shuning uchun bloklangan ilovalar ochilaveradi. Sessiyani davom ettirish uchun qayta yoqing.',
  'Turn blocking back on': 'Bloklashni qayta yoqish',
  'End focus session': 'Sessiyani tugatish',

  // Ending a session
  'End focus session?': 'Sessiyani tugatasizmi?',
  'Keep focusing': 'Davom etaman',
  'End session': 'Tugatish',
  'Are you sure?': 'Ishonchingiz komilmi?',
  'Stay focused': 'Fokusda qolaman',
  'Yes, end it': 'Ha, tugatilsin',
  'This session will be saved as stopped, not completed. This cannot be undone.':
    'Bu sessiya tugallangan emas, to’xtatilgan deb saqlanadi. Buni qaytarib bo’lmaydi.',

  // Apps
  'Choose apps': 'Ilovalarni tanlang',
  'BLOCK LIST': 'BLOKLASH RO\u2019YXATI',
  'Quiet the noise.': 'Shovqinni jim qiling.',
  'Choose the apps that are most likely to interrupt your intention.':
    'Niyatingizni buzishi ehtimoli eng yuqori ilovalarni tanlang.',
  'Search installed apps': 'O\u2019rnatilgan ilovalarni qidirish',
  'Clear search': 'Qidiruvni tozalash',
  'Apps selected': 'Ilova tanlandi',
  'Saved automatically': 'Avtomatik saqlanadi',
  All: 'Hammasi',
  'Finding your apps': 'Ilovalaringiz qidirilmoqda',
  'Only launchable apps will appear here.': 'Bu yerda faqat ochiladigan ilovalar ko\u2019rinadi.',
  'No matching apps': 'Mos ilova yo\u2019q',
  'No launchable apps found': 'Ochiladigan ilova topilmadi',
  'Try a different name or package.': 'Boshqa nom yoki paket bilan urinib ko\u2019ring.',
  'Qoriqchi could not find apps that can be opened.':
    'Qoriqchi ochilishi mumkin bo\u2019lgan ilovalarni topa olmadi.',
  'Search apps or package names': 'Ilova yoki paket nomini qidiring',
  'Select all': 'Hammasini tanlash',
  Clear: 'Tozalash',
  selected: 'tanlandi',
  'No matching apps.': 'Mos ilova topilmadi.',
  'No launchable apps were found.': 'Ochiladigan ilova topilmadi.',

  // Progress
  'YOUR PROGRESS': 'SIZNING NATIJANGIZ',
  'Momentum, made visible.': 'Natijangiz ko’rinadigan holda.',
  Week: 'Hafta',
  Month: 'Oy',
  Year: 'Yil',
  'Last 7 days': 'Oxirgi 7 kun',
  'Last 30 days': 'Oxirgi 30 kun',
  'Last 12 months': 'Oxirgi 12 oy',
  Completed: 'Tugallangan',
  'Distractions stopped': 'To’xtatilgan chalg’ish',
  'Focus time': 'Fokus vaqti',
  'Best so far': 'Eng yaxshisi',
  'No focus time in this window yet': 'Bu davrda hali fokus vaqti yo’q',
  'Top distractions': 'Eng ko’p chalg’itganlar',
  'Screen time': 'Ekran vaqti',
  'See where the time actually goes': 'Vaqt aslida qayerga ketayotganini ko’ring',
  'Turn on screen time': 'Ekran vaqtini yoqish',
  'Nothing recorded yet': 'Hali hech narsa yozilmagan',
  'Recent sessions': 'Oxirgi sessiyalar',
  'A quiet record of the time you protected and the impulses you outlasted.':
    'Siz himoyalagan vaqt va yengib o\u2019tgan istaklaringizning xotirjam yozuvi.',
  'Android has no screen-time data for this window.':
    'Android bu davr uchun ekran vaqti ma\u2019lumotiga ega emas.',
  '{n} total': 'jami {n}',
  'Your first session starts here': 'Birinchi sessiyangiz shu yerdan boshlanadi',
  'Completed and ended focus sessions will appear as your private progress timeline.':
    'Tugallangan va to\u2019xtatilgan sessiyalar shaxsiy natijalar tarixingiz sifatida ko\u2019rinadi.',
  'Manage protection, appearance, and the data that stays on this device.':
    'Himoya, ko\u2019rinish va qurilmada qoladigan ma\u2019lumotni boshqaring.',
  'Follow your phone or choose navy or black glass.':
    'Telefoningizga ergashsin yoki ko\u2019k hamda qora shisha orasidan tanlang.',
  'Accessibility disclosure': 'Accessibility bo\u2019yicha ma\u2019lumot',
  'Review exactly what Qoriqchi can access':
    'Qoriqchi nimaga kira olishini aniq ko\u2019ring',
  'Reset local data': 'Ma\u2019lumotlarni o\u2019chirish',
  'Selections, sessions, and statistics': 'Tanlovlar, sessiyalar va statistika',
  'Progress shows which apps held your attention.':
    'Natijalar bo\u2019limida qaysi ilova e\u2019tiboringizni olgani ko\u2019rinadi.',
  'Off. Blocking works exactly the same without it.':
    'O\u2019chirilgan. Bloklash usiz ham xuddi shunday ishlaydi.',
  'Manage usage access': 'Usage access\u2019ni boshqarish',
  Offline: 'Oflayn',
  'Focus without fighting yourself.': 'O\u2019zingiz bilan kurashmasdan fokuslaning.',
  'Enable focused protection': 'Himoyani yoqing',
  'One permission, explained clearly': 'Bitta ruxsat, ochiq tushuntirilgan',
  'Why this access is required': 'Bu ruxsat nega kerak',
  'Accessibility service enabled': 'Accessibility xizmati yoqilgan',
  'Enter Qoriqchi': 'Qoriqchiga kirish',
  'Ended early': 'Erta tugatilgan',
  total: 'jami',

  // Settings
  PREFERENCES: 'SOZLAMALAR',
  'Make it yours.': 'O’zingizga moslang.',
  Protection: 'Himoya',
  'App blocking service': 'Ilova bloklash xizmati',
  'Ready to protect your focus sessions.': 'Fokus sessiyalaringizni himoyalashga tayyor.',
  'Enable access before starting a session.': 'Sessiyani boshlashdan oldin ruxsat bering.',
  Ready: 'Tayyor',
  'Action needed': 'Harakat kerak',
  'Open Android settings': 'Android sozlamalarini ochish',
  'Enable protection': 'Himoyani yoqish',
  'Recheck permission status': 'Ruxsatni qayta tekshirish',
  'Screen time (optional)': 'Ekran vaqti (ixtiyoriy)',
  On: 'Yoqilgan',
  Off: 'O’chirilgan',
  Appearance: 'Ko’rinish',
  'Color mode': 'Rang rejimi',
  'Follow your phone or choose a fixed look.':
    'Telefoningizga ergashsin yoki o’zingiz tanlang.',
  Language: 'Til',
  'Follow your phone or pick a language.': 'Telefoningizga ergashsin yoki tilni tanlang.',
  Auto: 'Avto',
  Light: 'Yorug’',
  Dark: 'Qorong’u',
  Navy: 'Ko’k',
  Black: 'Qora',
  'Privacy & data': 'Maxfiylik va ma’lumot',
  'Private by default': 'Boshidanoq maxfiy',
  'No account, cloud sync, ads, or analytics.':
    'Akkaunt, bulut, reklama va analitika yo’q.',
  'Reset local data?': 'Ma’lumotlar o’chirilsinmi?',
  Cancel: 'Bekor qilish',
  Reset: 'O’chirish',

  // Onboarding
  'I understand and consent to this limited Accessibility use.':
    'Accessibility’ning shu cheklangan ishlatilishini tushundim va roziman.',
  'Open Accessibility settings': 'Accessibility sozlamalarini ochish',
  Continue: 'Davom etish',
  'Check access and continue': 'Ruxsatni tekshirib, davom etish',

  // Errors
  'That didn’t work': 'Bajarilmadi',
  'Got it': 'Tushundim',
};
