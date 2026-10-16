# Coaching Operations

React + Vite + Firebase Auth + Firestore. صلاحيتان: `lead` و`coordinator`.

## تشغيل سريع

1. `npm install`
2. انسخ `.env.example` إلى `.env` وأضف قيم Firebase Web App.
3. فعّل Email/Password من Firebase Authentication، وأنشئ حساب الـLead من Firebase Console.
4. فعّل Firestore وانشر `firestore.rules` من تبويب Rules.
5. أنشئ مستند `users/{UID}` للـLead، بقيمة `role` تساوي `lead`. أنشئ حسابات المنسقين في Authentication، ومستندًا لكل UID بقيمة `role` تساوي `coordinator`. بريد حساب المنسق يجب أن يساوي `Group Coordinator Email` في الشيت.
6. `npm run dev`

الـLead ترفع ملف Excel للجروبات، وملف Excel آخر به تبويب لكل جروب؛ اسم التبويب يطابق `Group Code`. عند وجود روابط Google Sheets في عمود `Table`، صدّر تبويبات الطلاب المطلوبة كملف XLSX أولًا. روابط `Table` تعرض للرجوع إلى الأصل، والاستيراد لا يقرأ Google Sheets الخاصة مباشرة. في شيت الجروبات، إذا تكرر عنوان `Phone` للمنسق والمدرب، سيقرأ Excel الثاني باسم `Phone.1`؛ يفضّل تسميته `Coach Phone` لضمان التطابق.

الرسائل تُفتح في واتساب يدويًا، والحالات تُحدّث يدويًا بعد الإرسال والتحقق من دخول الجروب. إعادة الاستيراد تحفظ حالات الطلاب إذا ظل User ID أو رقم الهاتف ثابتًا. لا تحذف الطلاب الذين أزيلوا من الملف؛ راجع البيانات قبل إعادة الاستيراد.
