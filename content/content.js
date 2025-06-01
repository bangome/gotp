/**
 * Google Authenticator Chrome Extension - Content Script
 * Google 로그인 페이지에서 OTP 자동 입력 기능 제공
 */

class GoogleOTPAutoFiller {
    constructor() {
        this.init();
    }

    init() {
        this.setupMessageListener();
        this.observePageChanges();
    }

    /**
     * Extension으로부터 메시지 수신 처리
     */
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'fillOTP') {
                const success = this.fillOTPField(request.code);
                sendResponse({ success });
            }
            return true;
        });
    }

    /**
     * 페이지 변화 감지 (SPA 대응)
     */
    observePageChanges() {
        // 페이지 로드 완료 후 초기 검사
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.checkForOTPField();
            });
        } else {
            this.checkForOTPField();
        }

        // DOM 변화 감지
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    this.checkForOTPField();
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * OTP 입력 필드 존재 확인
     */
    checkForOTPField() {
        const otpField = this.findOTPField();
        if (otpField) {
            this.highlightOTPField(otpField);
        }
    }

    /**
     * OTP 입력 필드 찾기
     */
    findOTPField() {
        // 다양한 OTP 입력 필드 선택자들
        const selectors = [
            // Google의 OTP 입력 필드
            'input[name="totpPin"]',
            'input[name="pin"]',
            'input[type="tel"][aria-label*="code"]',
            'input[type="tel"][aria-label*="코드"]',
            'input[type="text"][aria-label*="verification"]',
            'input[type="text"][aria-label*="인증"]',
            
            // 사용자가 제공한 특정 필드들
            'input[id="otpResult"]',
            'input[id="authkey"]',
            'input[class*="login_form_authkey"]',
            
            // 일반적인 OTP 필드 패턴들
            'input[placeholder*="OTP"]',
            'input[placeholder*="otp"]',
            'input[placeholder*="code"]',
            'input[placeholder*="코드"]',
            'input[placeholder*="인증"]',
            'input[placeholder*="verification"]',
            'input[placeholder*="6자리"]',
            'input[placeholder*="6 digit"]',
            'input[name*="otp"]',
            'input[name*="code"]',
            'input[name*="auth"]',
            'input[name*="verify"]',
            'input[name*="pin"]',
            'input[id*="otp"]',
            'input[id*="code"]',
            'input[id*="auth"]',
            'input[id*="verify"]',
            'input[id*="pin"]',
            'input[class*="otp"]',
            'input[class*="code"]',
            'input[class*="auth"]',
            'input[class*="verify"]',
            
            // 길이 기반 선택자
            'input[maxlength="6"][type="tel"]',
            'input[maxlength="6"][type="text"]',
            'input[maxlength="6"][type="number"]',
            'input[inputmode="numeric"]',
            'input[inputmode="tel"]',
            
            // 일반적인 ID/Name 패턴
            '#totpPin',
            '#verificationCode',
            '#otp',
            '#code',
            '#authCode',
            '#twoFactorCode',
            '#mfaCode',
            'input[name="verificationCode"]',
            'input[name="authCode"]',
            'input[name="twoFactorCode"]',
            'input[name="mfaCode"]'
        ];

        for (const selector of selectors) {
            try {
                const field = document.querySelector(selector);
                if (field && this.isValidOTPField(field)) {
                    console.log('OTP 필드 찾음:', selector, field);
                    return field;
                }
            } catch (error) {
                // 유효하지 않은 선택자는 무시
                continue;
            }
        }

        // 컨텍스트 기반 찾기
        return this.findOTPFieldByContext();
    }

    /**
     * 컨텍스트를 기반으로 OTP 필드 찾기
     */
    findOTPFieldByContext() {
        // "인증" 또는 "verification" 텍스트 근처의 입력 필드 찾기
        const contextKeywords = [
            'verification', '인증', 'code', '코드', 
            'authenticator', '보안', 'security', 'totp'
        ];

        const inputs = document.querySelectorAll('input[type="tel"], input[type="text"], input[type="number"]');
        
        for (const input of inputs) {
            if (!this.isValidOTPField(input)) continue;

            // 라벨 확인
            const label = this.findAssociatedLabel(input);
            if (label && this.containsKeywords(label.textContent, contextKeywords)) {
                return input;
            }

            // 부모 요소의 텍스트 확인
            const parent = input.closest('div, section, form');
            if (parent && this.containsKeywords(parent.textContent, contextKeywords)) {
                return input;
            }

            // 이전/다음 형제 요소 확인
            const siblings = this.getSiblingText(input);
            if (this.containsKeywords(siblings, contextKeywords)) {
                return input;
            }
        }

        return null;
    }

    /**
     * 유효한 OTP 필드인지 확인
     */
    isValidOTPField(field) {
        if (!field || field.disabled || field.readOnly) {
            return false;
        }

        // 길이 제한 확인 (보통 6자리)
        const maxLength = field.maxLength;
        if (maxLength && (maxLength < 4 || maxLength > 8)) {
            return false;
        }

        // 숨겨진 필드 제외
        const style = window.getComputedStyle(field);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }

        return true;
    }

    /**
     * 연관된 라벨 찾기
     */
    findAssociatedLabel(input) {
        // for 속성으로 연결된 라벨
        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) return label;
        }

        // 부모 라벨
        const parentLabel = input.closest('label');
        if (parentLabel) return parentLabel;

        // 이전 형제 라벨
        let sibling = input.previousElementSibling;
        while (sibling) {
            if (sibling.tagName === 'LABEL') {
                return sibling;
            }
            sibling = sibling.previousElementSibling;
        }

        return null;
    }

    /**
     * 형제 요소의 텍스트 수집
     */
    getSiblingText(element) {
        let text = '';
        
        // 이전 형제들
        let prev = element.previousElementSibling;
        let count = 0;
        while (prev && count < 3) {
            text += ' ' + prev.textContent;
            prev = prev.previousElementSibling;
            count++;
        }

        // 다음 형제들
        let next = element.nextElementSibling;
        count = 0;
        while (next && count < 3) {
            text += ' ' + next.textContent;
            next = next.nextElementSibling;
            count++;
        }

        return text;
    }

    /**
     * 키워드 포함 여부 확인
     */
    containsKeywords(text, keywords) {
        if (!text) return false;
        
        const lowerText = text.toLowerCase();
        return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
    }

    /**
     * OTP 필드에 값 입력
     */
    fillOTPField(code) {
        const otpField = this.findOTPField();
        
        if (!otpField) {
            console.log('OTP 입력 필드를 찾을 수 없습니다.');
            return false;
        }

        try {
            // 기존 값 클리어
            otpField.value = '';
            
            // 포커스 설정
            otpField.focus();
            
            // 값 설정
            otpField.value = code;
            
            // 다양한 이벤트 발생
            this.triggerEvents(otpField, code);
            
            // 시각적 피드백
            this.showSuccessIndicator(otpField);
            
            console.log('OTP 코드가 자동으로 입력되었습니다:', code);
            return true;
            
        } catch (error) {
            console.error('OTP 입력 중 오류 발생:', error);
            return false;
        }
    }

    /**
     * 필드에 이벤트 발생
     */
    triggerEvents(field, value) {
        // Input 이벤트
        const inputEvent = new Event('input', { bubbles: true });
        field.dispatchEvent(inputEvent);
        
        // Change 이벤트
        const changeEvent = new Event('change', { bubbles: true });
        field.dispatchEvent(changeEvent);
        
        // KeyDown/KeyUp 이벤트 (각 문자에 대해)
        for (let i = 0; i < value.length; i++) {
            const char = value[i];
            const keyCode = char.charCodeAt(0);
            
            const keyDownEvent = new KeyboardEvent('keydown', {
                key: char,
                keyCode: keyCode,
                bubbles: true
            });
            field.dispatchEvent(keyDownEvent);
            
            const keyUpEvent = new KeyboardEvent('keyup', {
                key: char,
                keyCode: keyCode,
                bubbles: true
            });
            field.dispatchEvent(keyUpEvent);
        }
        
        // React/Vue 등 프레임워크를 위한 추가 이벤트
        const reactEvents = ['onInput', 'onChange'];
        reactEvents.forEach(eventName => {
            if (field[eventName]) {
                field[eventName]({ target: field });
            }
        });
    }

    /**
     * OTP 필드 하이라이트
     */
    highlightOTPField(field) {
        const originalBorder = field.style.border;
        const originalBoxShadow = field.style.boxShadow;
        
        field.style.border = '2px solid #4285f4';
        field.style.boxShadow = '0 0 5px rgba(66, 133, 244, 0.3)';
        
        setTimeout(() => {
            field.style.border = originalBorder;
            field.style.boxShadow = originalBoxShadow;
        }, 2000);
    }

    /**
     * 성공 표시기 표시
     */
    showSuccessIndicator(field) {
        // 이미 표시기가 있으면 제거
        const existingIndicator = document.querySelector('.otp-autofill-success');
        if (existingIndicator) {
            existingIndicator.remove();
        }

        // 성공 표시기 생성
        const indicator = document.createElement('div');
        indicator.className = 'otp-autofill-success';
        indicator.innerHTML = '✓';
        indicator.style.cssText = `
            position: absolute;
            right: -30px;
            top: 50%;
            transform: translateY(-50%);
            background: #34a853;
            color: white;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            z-index: 10000;
            animation: fadeInOut 2s ease-in-out;
        `;

        // 애니메이션 CSS 추가
        if (!document.querySelector('#otp-autofill-styles')) {
            const style = document.createElement('style');
            style.id = 'otp-autofill-styles';
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateY(-50%) scale(0.5); }
                    20% { opacity: 1; transform: translateY(-50%) scale(1); }
                    80% { opacity: 1; transform: translateY(-50%) scale(1); }
                    100% { opacity: 0; transform: translateY(-50%) scale(0.5); }
                }
            `;
            document.head.appendChild(style);
        }

        // 필드의 부모에 상대 위치 설정
        const parent = field.parentElement;
        const originalPosition = parent.style.position;
        if (!originalPosition || originalPosition === 'static') {
            parent.style.position = 'relative';
        }

        parent.appendChild(indicator);

        // 2초 후 제거
        setTimeout(() => {
            if (indicator.parentElement) {
                indicator.remove();
            }
            if (!originalPosition || originalPosition === 'static') {
                parent.style.position = originalPosition;
            }
        }, 2000);
    }
}

// Content Script 초기화 - 모든 사이트에서 작동
new GoogleOTPAutoFiller(); 