// Скрипт переименования: recipesContainer/recipes -> recipes
// Запуск: node rename-folder.js

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('./');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const USER_ID = 'BHp3aoqYOWWzHOr5nAQ4X1Ltkuq1';

async function renameFolder() {
  try {
    console.log('🚀 Начинаем переименование...');

    // Источник: recipesContainer/recipes
    const sourceRef = db.collection(`users/${USER_ID}/data/recipesContainer/recipes`);
    const snapshot = await sourceRef.get();

    if (snapshot.empty) {
      console.log('❌ Источник пуст');
      return;
    }

    console.log(`📚 Найдено ${snapshot.size} рецептов`);

    // Назначение: recipes (внутри data)
    const targetRef = db.doc(`users/${USER_ID}/data`).collection('recipes');

    let copiedCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      await targetRef.doc(doc.id).set(data);
      copiedCount++;
      console.log(`✅ Скопирован: ${data.name || doc.id}`);
    }

    // Удаляем source
    for (const doc of snapshot.docs) {
      await sourceRef.doc(doc.id).delete();
    }
    await db.doc(`users/${USER_ID}/data/recipesContainer`).delete();

    console.log(`\n🎉 Готово!`);
    console.log(`📂 Новая папка: users/${USER_ID}/data/recipes`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

renameFolder();
