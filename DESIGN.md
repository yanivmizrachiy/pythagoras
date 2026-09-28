# DESIGN — מדריך יישום

מסמך זה הוא **מדריך יישום בלבד**. הסמכות היחידה היא [SOURCE_OF_TRUTH.md](SOURCE_OF_TRUTH.md).

## A4
- כל דף נשאר 210×297 מ"מ.
- אין responsive reflow פנימי; התאמה למסך היא scaling חיצוני.
- אין overflow אופקי.
- CSS של כל דף נמצא ב-`styles/pages/עמוד-N.css`.

## מעטפת
- `index.html` הוא loader התוכן היחיד.
- `book-design.js` מוסיף reader, נגישות ומצבי תצוגה בלבד.
- `book-design.css` ו-`ui-controls.css` אינם משנים גאומטריה פנימית של דפי התוכן.
- אסור להחזיר `pythagoras-workbook.js`.

## עיצוב
- RTL מלא ו-Rubik לטקסט עברי.
- MathJax למתמטיקה.
- הצל החיצוני של דף סימטרי.
- אין פסי צד/הדגשות חד־צדדיות או סיווג תוכן אוטומטי לצורך עיצוב.
- יעד מגע נוח במובייל ו-`prefers-reduced-motion`.

## מתמטיקה
- כפל: `·` / `\cdot`, לא `×` / `\times`.
- פתרון רב־שלבי אנכי.
- הבחנה בין אורך לריבוע אורך.
- מקום תשובה בגודל שמתאים לתשובה הצפויה.

## ביצועים
- הדף הפעיל ראשון.
- lazy loading לשאר הדפים.
- MathJax בתור מסודר.
- אין bootstrap, navigation, listener או Download כפולים.

כל שינוי עיצובי חייב לעבור `npm run validate`.
