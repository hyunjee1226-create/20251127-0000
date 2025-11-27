import './style.css'

const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY
const SYSTEM_PROMPT =
  '당신은 저녁 메뉴를 추천하는 셰프이자 소믈리에입니다. ' +
  '추천은 한국어로 작성하고, 2~3개의 메인 메뉴와 가벼운 곁들임/음료를 짧게 제안하세요. ' +
  '기온, 날씨, 기분과 같은 맥락을 반영하고, 각 메뉴에 간단한 이유를 덧붙이세요.'
const chatHistory = []

const app = document.querySelector('#app')

app.innerHTML = `
  <div class="page-shell">
    <div class="glass-panel">
      <header class="hero">
        <p class="eyebrow">저녁 챗봇</p>
        <h1>오늘 저녁, 무엇이 어울릴까요?</h1>
        <p class="hero-copy">
          ChatGPT에게 기분과 상황을 알려주면 저녁 메뉴를 추천해 드려요.
        </p>
        <div class="api-status" id="apiStatus">
          <span class="status-dot" id="apiStatusDot"></span>
          <span class="status-text" id="apiStatusText">API 키 상태를 확인하는 중입니다.</span>
        </div>
      </header>

      <section class="chat-panel">
        <div class="message-area" id="chatMessages" aria-live="polite"></div>
        <form class="chat-form" id="chatForm" autocomplete="off">
          <input
            id="chatInput"
            type="text"
            placeholder="예) 시원하고 가벼운 메뉴 없을까?"
            aria-label="챗봇에게 전할 메시지 입력"
            required
          />
          <button type="submit" id="chatSubmit">
            <span class="btn-label-default">추천 받기</span>
            <span class="btn-label-loading">추천 중...</span>
          </button>
        </form>
      </section>
    </div>
  </div>
`

const chatMessages = document.querySelector('#chatMessages')
const chatForm = document.querySelector('#chatForm')
const chatInput = document.querySelector('#chatInput')
const submitButton = document.querySelector('#chatSubmit')
const apiStatusText = document.querySelector('#apiStatusText')
const apiStatusDot = document.querySelector('#apiStatusDot')

const STATUS_CLASS = {
  idle: 'is-idle',
  checking: 'is-checking',
  ready: 'is-ready',
  missing: 'is-missing',
  error: 'is-error',
}

const apiStatusElement = document.querySelector('#apiStatus')

function setApiStatus(state, label) {
  Object.values(STATUS_CLASS).forEach((className) => {
    apiStatusElement.classList.remove(className)
  })

  apiStatusElement.classList.add(STATUS_CLASS[state])
  apiStatusText.textContent = label
}

function appendMessage(role, text) {
  const bubble = document.createElement('div')
  bubble.className = `bubble bubble-${role}`

  const avatar = document.createElement('span')
  avatar.className = 'bubble-avatar'
  avatar.textContent = role === 'user' ? '🙂' : '🌿'

  const paragraph = document.createElement('p')
  paragraph.textContent = text

  bubble.appendChild(avatar)
  bubble.appendChild(paragraph)
  chatMessages.appendChild(bubble)
  chatMessages.scrollTop = chatMessages.scrollHeight

  return bubble
}

function toggleSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting
  chatInput.disabled = isSubmitting
  chatForm.classList.toggle('is-loading', isSubmitting)
}

function buildMessages(userMessage) {
  return [
    {
      role: 'system',
      content: SYSTEM_PROMPT,
    },
    ...chatHistory,
    {
      role: 'user',
      content: `요청 내용: ${userMessage}`,
    },
  ]
}

async function requestMenuSuggestion(userMessage) {
  if (!OPENAI_KEY) {
    throw new Error('브라우저에서 API 키를 찾지 못했습니다.')
  }

  const payload = {
    model: 'gpt-4o-mini',
    temperature: 0.8,
    max_tokens: 320,
    messages: buildMessages(userMessage),
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}))
    const message =
      errorPayload?.error?.message ||
      `OpenAI 응답 오류 (${response.status})`
    throw new Error(message)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content?.trim()

  if (!content) {
    throw new Error('ChatGPT 응답이 비어 있습니다.')
  }

  return content
}

function init() {
  if (OPENAI_KEY) {
    setApiStatus('idle', 'API 키 감지 완료 · 테스트 대기 중')
  } else {
    setApiStatus('missing', '.env 파일에서 VITE_OPENAI_API_KEY를 확인하세요')
  }

  const greeting =
    '원하는 분위기나 재료를 알려주시면 메뉴를 추천해 드릴게요!'
  appendMessage('assistant', greeting)
  chatHistory.push({
    role: 'assistant',
    content: greeting,
  })
}

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  const userMessage = chatInput.value.trim()
  if (!userMessage) return

  appendMessage('user', userMessage)
  chatInput.value = ''

  const thinkingBubble = appendMessage(
    'assistant',
    '메뉴 아이디어를 가다듬는 중이에요...'
  )

  toggleSubmitting(true)
  if (OPENAI_KEY) {
    setApiStatus('checking', 'ChatGPT와 통신 중...')
  }

  try {
    const suggestion = await requestMenuSuggestion(userMessage)
    thinkingBubble.querySelector('p').textContent = suggestion
    chatHistory.push(
      {
        role: 'user',
        content: `요청 내용: ${userMessage}`,
      },
      {
        role: 'assistant',
        content: suggestion,
      }
    )
    if (OPENAI_KEY) {
      setApiStatus('ready', 'API 키 정상 작동 · 최신 추천 완료')
    }
  } catch (error) {
    thinkingBubble.querySelector('p').textContent =
      error.message || '추천을 불러오지 못했습니다.'
    setApiStatus(
      'error',
      'API 통신 중 문제가 발생했습니다. 키와 네트워크를 확인하세요.'
    )
    console.error(error)
  } finally {
    toggleSubmitting(false)
  }
})

init()
