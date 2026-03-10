const questionsPerPage = 100;
let currentPage = 1;
let questions = [];
let userAnswers = {};  // Все ответы пользователя
let correctAnswers = {};  // Ответы, правильно ли они
let selectedAnswers = {};  // Все выборы ответов
let questionResults = {};  // Сохранение информации о правильности/неправильности ответов
let finishedPages = {}; // Объект для хранения результатов завершенных страниц

// Проверка пароля при загрузке
const CORRECT_PASSWORD = '2026';
const PASSWORD_STORAGE_KEY = 'quizPasswordVerified';

// Проверяем, введен ли правильный пароль
function checkPasswordAccess() {
    const isVerified = localStorage.getItem(PASSWORD_STORAGE_KEY) === 'true';
    
    if (isVerified) {
        showMainContent();
    } else {
        showPasswordModal();
    }
}

// Показываем модальное окно пароля
function showPasswordModal() {
    const modal = document.getElementById('password-modal');
    const mainContent = document.getElementById('main-content');
    
    if (modal) modal.style.display = 'flex';
    if (mainContent) mainContent.style.display = 'none';
}

// Показываем основной контент
function showMainContent() {
    const modal = document.getElementById('password-modal');
    const mainContent = document.getElementById('main-content');
    
    if (modal) modal.style.display = 'none';
    if (mainContent) mainContent.style.display = 'block';
    
    // Инициализируем квиз только после успешного ввода пароля
    initQuiz();
}

// Обработчик проверки пароля
function setupPasswordHandler() {
    const submitButton = document.getElementById('submit-password');
    const passwordInput = document.getElementById('password-input');
    const errorElement = document.getElementById('password-error');
    
    if (!submitButton || !passwordInput) return;
    
    submitButton.addEventListener('click', () => {
        const enteredPassword = passwordInput.value;
        
        if (enteredPassword === CORRECT_PASSWORD) {
            localStorage.setItem(PASSWORD_STORAGE_KEY, 'true');
            errorElement.textContent = '';
            showMainContent();
        } else {
            errorElement.textContent = 'Неверный пароль!';
            passwordInput.value = '';
        }
    });
    
    // Поддержка Enter для ввода пароля
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitButton.click();
        }
    });
}

// Инициализация квиза
function initQuiz() {
    // Загрузка данных из localStorage
    const savedData = JSON.parse(localStorage.getItem('quizData'));
    if (savedData) {
        currentPage = savedData.currentPage;
        userAnswers = savedData.userAnswers || {};
        correctAnswers = savedData.correctAnswers || {};
        selectedAnswers = savedData.selectedAnswers || {};
        questionResults = savedData.questionResults || {};  // Загружаем информацию о правильности ответов
        finishedPages = savedData.finishedPages || {}; // Загружаем завершенные страницы
    }

    questions = data;
    renderPage(currentPage);
    renderPagination();
}

function renderPage(page) {
    const start = (page - 1) * questionsPerPage;
    const end = start + questionsPerPage;
    const pageQuestions = questions.slice(start, end);
    const container = document.getElementById('quiz-container');

    if (!container) {
        console.error('Контейнер для вопросов не найден!');
        return;
    }

    container.innerHTML = ''; // Очистка контейнера перед рендером

    pageQuestions.forEach((q, index) => {
        const questionNumber = start + index + 1;
        const questionDiv = document.createElement('div');
        questionDiv.classList.add('question');
        questionDiv.id = `question-${questionNumber}`;
        questionDiv.innerHTML = `<h3>${questionNumber}. ${q.question}</h3>`;

        const shuffledOptions = q.options.sort(() => Math.random() - 0.5);
        const ul = document.createElement('ul');
        ul.classList.add('options');

        shuffledOptions.forEach(option => {
            const li = document.createElement('li');
            const inputType = q.correctAnswer.length === 1 ? 'radio' : 'checkbox';
            const isChecked = selectedAnswers[questionNumber]?.includes(option);
            const isDisabled = questionResults[questionNumber] !== undefined; // Если ответ уже подтвержден, элементы заблокированы

            li.innerHTML = `<label><input type="${inputType}" name="q${questionNumber}" value="${option}" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}> ${option}</label>`;
            ul.appendChild(li);
        });

        questionDiv.appendChild(ul);

        const confirmButton = document.createElement('button');
        confirmButton.innerText = 'Подтвердить';
        confirmButton.disabled = !Array.from(ul.querySelectorAll('input')).some(input => input.checked); // Отключаем кнопку, если нет выбора

        // Если ответ уже подтвержден, кнопка будет отключена
        if (questionResults[questionNumber] !== undefined) {
            const resultMessage = document.createElement('div');
            resultMessage.classList.add(questionResults[questionNumber] ? 'correct' : 'incorrect');
            resultMessage.innerText = questionResults[questionNumber] ? 'Правильно!' : `Неправильно! Правильный ответ: ${q.correctAnswer.join(', ')}`;
            questionDiv.appendChild(resultMessage);
            confirmButton.disabled = true;
        }

        ul.addEventListener('change', () => {
            confirmButton.disabled = !Array.from(ul.querySelectorAll('input')).some(input => input.checked);
            checkAllAnswered(); // Проверка, все ли вопросы отвечены
        });

        confirmButton.addEventListener('click', () => {
            const inputs = questionDiv.querySelectorAll(`input[name="q${questionNumber}"]`);
            const selected = Array.from(inputs).filter(input => input.checked).map(input => input.value);
            selectedAnswers[questionNumber] = selected;

            const isCorrect = selected.sort().join(',') === q.correctAnswer.sort().join(',');
            correctAnswers[questionNumber] = isCorrect;
            userAnswers[questionNumber] = selected;

            handleAnswerConfirmation(questionNumber, q.correctAnswer, isCorrect);

            // Отключаем все элементы ввода после подтверждения
            inputs.forEach(input => {
                input.disabled = true;
            });
            confirmButton.disabled = true;
            checkAllAnswered(); // Проверка, все ли вопросы отвечены

            saveProgress(); // Сохраняем прогресс после каждого ответа
        });

        questionDiv.appendChild(confirmButton);
        container.appendChild(questionDiv);
    });

    const finishButton = document.createElement('button');
    finishButton.innerText = 'Завершить страницу';
    finishButton.disabled = true; // Кнопка изначально отключена
    finishButton.addEventListener('click', () => {
        calculateResults();
    });

    const resultContainer = document.getElementById('result');
    resultContainer.innerHTML = '';
    resultContainer.appendChild(finishButton);

    // Если страница уже завершена, загружаем её результат
    if (finishedPages[currentPage] !== undefined) {
        resultContainer.innerHTML = `<h3>Результат: ${finishedPages[currentPage]}% правильных ответов</h3>`;
        finishButton.disabled = true; // Отключаем кнопку, если страница уже завершена
    }

    updateCurrentPageDisplay();
    checkAllAnswered(); // Проверка, можно ли активировать кнопку "Завершить страницу"
}

function handleAnswerConfirmation(questionNumber, correctAnswer, isCorrect) {
    // Сохраняем информацию о правильности/неправильности ответа
    questionResults[questionNumber] = isCorrect;

    const resultMessage = document.createElement('div');
    resultMessage.classList.add(isCorrect ? 'correct' : 'incorrect');
    resultMessage.innerText = isCorrect ? 'Правильно!' : `Неправильно! Правильный ответ: ${correctAnswer.join(', ')}`;
    const questionElement = document.getElementById(`question-${questionNumber}`);
    questionElement.appendChild(resultMessage);
}

function calculateResults() {
    const start = (currentPage - 1) * questionsPerPage;
    const end = Math.min(start + questionsPerPage, questions.length);
    
    let correctCount = 0;
    let answeredCount = 0;
    
    // Считаем только вопросы на текущей странице
    for (let i = start; i < end; i++) {
        const questionNumber = i + 1;
        const question = questions[i];
        
        if (userAnswers[questionNumber]) {
            answeredCount++;
            const isCorrect = userAnswers[questionNumber].sort().join(',') === question.correctAnswer.sort().join(',');
            if (isCorrect) correctCount++;
        }
    }

    const percentage = answeredCount > 0 ? ((correctCount / answeredCount) * 100).toFixed(2) : 0;
    finishedPages[currentPage] = percentage; // Сохраняем результат для текущей страницы

    const resultContainer = document.getElementById('result');
    resultContainer.innerHTML = `<h3>Результат: ${percentage}% правильных ответов</h3>`;

    saveProgress(); // Сохраняем прогресс после завершения страницы
}

function renderPagination() {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(questions.length / questionsPerPage);
    pagination.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
        const button = document.createElement('button');
        button.innerText = `${(i-1)*questionsPerPage} - ${i*questionsPerPage > 3026? 3027: i*questionsPerPage}`;
        button.id = `pagination-${i}`;
        button.addEventListener('click', () => {
            currentPage = i;
            renderPage(i);
            renderPagination(); // Перерисовываем пагинацию, чтобы обновить подсветку
            window.scrollTo(0,0);
            saveProgress();
        });
        pagination.appendChild(button);
    }

    // Подсвечиваем текущую страницу
    const buttons = pagination.querySelectorAll('button');
    buttons.forEach(button => {
        if (button.id === `pagination-${currentPage}`) {
            button.classList.add('active'); // Добавляем класс для подсветки
        } else {
            button.classList.remove('active');
        }
    });
}

function updateCurrentPageDisplay() {
    const currentPageContainer = document.getElementById('current-page');
    currentPageContainer.innerHTML = `<strong>Текущая страница: ${currentPage}</strong>`;
}

// Функция для проверки, все ли вопросы на текущей странице отвечены
function checkAllAnswered() {
    const questionDivs = document.querySelectorAll('.question');
    let allAnswered = true;

    questionDivs.forEach(questionDiv => {
        const inputs = questionDiv.querySelectorAll('input');
        const answered = Array.from(inputs).some(input => input.checked);
        if (!answered) {
            allAnswered = false;
        }
    });

    // Включаем кнопку "Завершить страницу", если все вопросы отвечены
    const finishButton = document.querySelector('#result button');
    if (finishButton) {
        finishButton.disabled = !allAnswered;
    }
}

// Функция для сохранения прогресса в localStorage
function saveProgress() {
    const quizData = {
        currentPage: currentPage,
        userAnswers: userAnswers,
        correctAnswers: correctAnswers,
        selectedAnswers: selectedAnswers,
        questionResults: questionResults, // Сохраняем результаты для каждого вопроса
        answeredQuestions: Object.keys(questionResults), // Храним, какие вопросы уже были отвечены
        finishedPages: finishedPages // Сохраняем результаты завершенных страниц
    };
    localStorage.setItem('quizData', JSON.stringify(quizData));
}

// Функция для сброса прогресса
function resetProgress() {
    localStorage.removeItem('quizData');
    userAnswers = {};
    correctAnswers = {};
    selectedAnswers = {};
    questionResults = {}; // Очищаем результаты правильности
    finishedPages = {}; // Очищаем завершенные страницы
    currentPage = 1;
    renderPage(currentPage);
    renderPagination();
    window.scrollTo(0,0);
}

// Добавляем обработчик для кнопки сброса
document.getElementById('reset-progress').addEventListener('click', resetProgress);

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    checkPasswordAccess();
    setupPasswordHandler();
});