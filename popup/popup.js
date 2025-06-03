/**
 * G-OTP Chrome Extension - Popup Script
 */

class AuthenticatorPopup {
    constructor() {
        this.totp = new TOTP();
        this.accounts = [];
        this.currentEditingId = null;
        this.updateInterval = null;
        
        this.init();
    }

    async init() {
        await this.loadAccounts();
        this.setupEventListeners();
        this.renderAccounts();
        this.startPeriodicUpdate();
    }

    /**
     * Chrome Storage에서 계정 목록 로드
     */
    async loadAccounts() {
        try {
            const result = await chrome.storage.sync.get(['accounts']);
            this.accounts = result.accounts || [];
        } catch (error) {
            console.error('계정 로드 오류:', error);
            this.accounts = [];
        }
    }

    /**
     * Chrome Storage에 계정 목록 저장
     */
    async saveAccounts() {
        try {
            await chrome.storage.sync.set({ accounts: this.accounts });
        } catch (error) {
            console.error('계정 저장 오류:', error);
            this.showToast('계정 저장에 실패했습니다.', 'error');
        }
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 계정 추가 버튼
        document.getElementById('addAccountBtn').addEventListener('click', () => {
            this.openModal();
        });

        // 모달 닫기
        document.getElementById('closeModalBtn').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.closeModal();
        });

        // 모달 오버레이 클릭으로 닫기
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'modalOverlay') {
                this.closeModal();
            }
        });

        // 계정 폼 제출
        document.getElementById('accountForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAccountSubmit();
        });

        // ESC 키로 모달 닫기 및 숫자 키 단축키
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            } else if (e.key >= '1' && e.key <= '9') {
                // 모달이 열려있지 않을 때만 숫자 키 단축키 동작
                const modal = document.getElementById('modalOverlay');
                if (!modal.classList.contains('show')) {
                    this.handleNumberKeyPress(parseInt(e.key));
                }
            }
        });
    }

    /**
     * 숫자 키 단축키 처리
     */
    async handleNumberKeyPress(number) {
        // 1-9 키를 0-8 인덱스로 변환
        const index = number - 1;
        
        if (index < this.accounts.length) {
            const account = this.accounts[index];
            
            // 해당 계정의 OTP 코드 생성
            const otpCode = await this.totp.generateTOTP(account.secret);
            
            if (otpCode) {
                // 시각적 피드백을 위해 해당 계정 아이템을 잠시 하이라이트
                this.highlightAccountItem(index);
                
                // OTP 코드 복사 및 자동입력
                await this.copyToClipboard(otpCode, `${account.name} 코드가 복사되었습니다.`);
            }
        }
    }

    /**
     * 계정 아이템 하이라이트 표시
     */
    highlightAccountItem(index) {
        const accountItems = document.querySelectorAll('.account-item');
        
        if (accountItems[index]) {
            const item = accountItems[index];
            
            // 하이라이트 클래스 추가
            item.style.transform = 'scale(1.02)';
            item.style.boxShadow = 'var(--shadow-hover)';
            item.style.transition = 'all 0.2s ease';
            
            // 0.3초 후 원래 상태로 복원
            setTimeout(() => {
                item.style.transform = '';
                item.style.boxShadow = '';
            }, 300);
        }
    }

    /**
     * 모달 열기
     */
    openModal(account = null) {
        const modal = document.getElementById('modalOverlay');
        const title = document.getElementById('modalTitle');
        const form = document.getElementById('accountForm');

        if (account) {
            // 편집 모드
            title.textContent = '계정 편집';
            document.getElementById('accountName').value = account.name;
            document.getElementById('secretKey').value = account.secret;
            document.getElementById('issuer').value = account.issuer || '';
            this.currentEditingId = account.id;
        } else {
            // 추가 모드
            title.textContent = '계정 추가';
            form.reset();
            this.currentEditingId = null;
        }

        modal.classList.add('show');
        document.getElementById('accountName').focus();
    }

    /**
     * 모달 닫기
     */
    closeModal() {
        const modal = document.getElementById('modalOverlay');
        modal.classList.remove('show');
        document.getElementById('accountForm').reset();
        this.currentEditingId = null;
    }

    /**
     * 계정 폼 제출 처리
     */
    async handleAccountSubmit() {
        const name = document.getElementById('accountName').value.trim();
        const secret = document.getElementById('secretKey').value.trim().replace(/\s/g, '').toUpperCase();
        const issuer = document.getElementById('issuer').value.trim();

        if (!name || !secret) {
            this.showToast('계정 이름과 Secret Key를 입력해주세요.', 'error');
            return;
        }

        // Secret Key 유효성 검사
        if (!this.isValidBase32(secret)) {
            this.showToast('유효하지 않은 Secret Key입니다.', 'error');
            return;
        }

        const account = {
            id: this.currentEditingId || this.generateId(),
            name,
            secret,
            issuer: issuer || null,
            createdAt: this.currentEditingId ? 
                this.accounts.find(acc => acc.id === this.currentEditingId)?.createdAt : 
                Date.now()
        };

        if (this.currentEditingId) {
            // 편집
            const index = this.accounts.findIndex(acc => acc.id === this.currentEditingId);
            if (index !== -1) {
                this.accounts[index] = account;
            }
        } else {
            // 추가
            this.accounts.push(account);
        }

        await this.saveAccounts();
        this.renderAccounts();
        this.closeModal();
        this.showToast(this.currentEditingId ? '계정이 수정되었습니다.' : '계정이 추가되었습니다.');
    }

    /**
     * Base32 유효성 검사
     */
    isValidBase32(secret) {
        const base32Regex = /^[A-Z2-7]+=*$/;
        return base32Regex.test(secret) && secret.length >= 16;
    }

    /**
     * 계정 목록 렌더링
     */
    async renderAccounts() {
        const container = document.getElementById('accountsContainer');
        const emptyState = document.getElementById('emptyState');
        const shortcutHint = document.querySelector('.shortcut-hint');
        
        if (this.accounts.length === 0) {
            emptyState.style.display = 'block';
            if (shortcutHint) {
                shortcutHint.style.display = 'none';
            }
            return;
        }
        
        emptyState.style.display = 'none';
        if (shortcutHint) {
            shortcutHint.style.display = 'block';
        }
        
        // 기존 계정 아이템 제거 (템플릿과 empty state 제외)
        const existingItems = container.querySelectorAll('.account-item');
        existingItems.forEach(item => item.remove());
        
        for (let i = 0; i < this.accounts.length; i++) {
            const account = this.accounts[i];
            const accountElement = await this.createAccountElement(account, i);
            container.appendChild(accountElement);
        }
    }

    /**
     * 계정 요소 생성
     */
    async createAccountElement(account, index) {
        const template = document.getElementById('accountTemplate');
        const clone = template.content.cloneNode(true);
        const accountItem = clone.querySelector('.account-item');
        
        accountItem.dataset.accountId = account.id;
        
        // 계정 번호 설정 (1부터 시작, 9까지만 표시)
        const numberElement = clone.querySelector('.account-number');
        if (index < 9) {
            numberElement.textContent = (index + 1).toString();
            numberElement.title = `단축키: ${index + 1}`;
        } else {
            numberElement.style.display = 'none';
        }
        
        // 계정 정보 설정
        clone.querySelector('.account-name').textContent = account.name;
        const issuerElement = clone.querySelector('.account-issuer');
        if (account.issuer) {
            issuerElement.textContent = account.issuer;
        } else {
            issuerElement.style.display = 'none';
        }
        
        // OTP 코드 생성 및 표시
        const otpCode = await this.totp.generateTOTP(account.secret);
        const otpElement = clone.querySelector('.otp-code');
        otpElement.textContent = otpCode || '------';
        
        // 시간 진행 바 설정
        this.updateTimeProgress(clone);
        
        // 이벤트 리스너 설정
        this.setupAccountEventListeners(clone, account);
        
        return clone;
    }

    /**
     * 계정 아이템 이벤트 리스너 설정
     */
    setupAccountEventListeners(element, account) {
        // OTP 코드 클릭 - 복사
        const otpElement = element.querySelector('.otp-code');
        otpElement.addEventListener('click', () => {
            this.copyToClipboard(otpElement.textContent, '코드가 복사되었습니다.');
        });

        // 편집 버튼
        const editBtn = element.querySelector('.edit-btn');
        editBtn.addEventListener('click', () => {
            this.openModal(account);
        });

        // 삭제 버튼
        const deleteBtn = element.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
            this.deleteAccount(account.id);
        });
    }

    /**
     * 시간 진행 바 업데이트
     */
    updateTimeProgress(element) {
        const timeBar = element.querySelector('.time-bar');
        const timeRemaining = element.querySelector('.time-remaining');
        
        const remaining = this.totp.getTimeRemaining();
        const ratio = this.totp.getTimeRemainingRatio();
        
        timeBar.style.setProperty('--progress', `${ratio * 100}%`);
        timeRemaining.textContent = `${remaining}s`;
        
        // CSS로 진행 바 애니메이션
        timeBar.style.background = `linear-gradient(to right, 
            var(--success-color) 0%, 
            var(--success-color) ${ratio * 100}%, 
            var(--border-color) ${ratio * 100}%, 
            var(--border-color) 100%)`;
    }

    /**
     * 계정 삭제
     */
    async deleteAccount(accountId) {
        if (confirm('이 계정을 삭제하시겠습니까?')) {
            this.accounts = this.accounts.filter(acc => acc.id !== accountId);
            await this.saveAccounts();
            this.renderAccounts();
            this.showToast('계정이 삭제되었습니다.');
        }
    }

    /**
     * 클립보드에 텍스트 복사
     */
    async copyToClipboard(text, message = '복사되었습니다.') {
        try {
            await navigator.clipboard.writeText(text);
            
            // 모든 사이트에서 OTP 자동 입력 시도
            const autoFillSuccess = await this.tryAutoFill(text);
            
            if (autoFillSuccess) {
                // 자동 입력 성공 시 팝업 자동 닫기
                this.showToast('코드가 자동으로 입력되었습니다.');
                setTimeout(() => {
                    window.close();
                }, 1200); // 1.2초 후 팝업 닫기
            } else {
                // Google 페이지가 아닌 경우 복사만 완료
                this.showToast(message);
                // 일반적인 복사의 경우 짧은 지연 후 팝업 닫기
                setTimeout(() => {
                    window.close();
                }, 800); // 0.8초 후 팝업 닫기
            }
        } catch (error) {
            console.error('클립보드 복사 오류:', error);
            this.showToast('복사에 실패했습니다.', 'error');
        }
    }

    /**
     * 모든 사이트에서 OTP 자동 입력 시도
     */
    async tryAutoFill(otpCode) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // 모든 사이트에서 자동 입력 시도
            if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
                const response = await chrome.tabs.sendMessage(tab.id, {
                    action: 'fillOTP',
                    code: otpCode
                });
                
                if (response && response.success) {
                    return true; // 자동 입력 성공
                }
            }
            return false; // 자동 입력 실패
        } catch (error) {
            console.log('자동 입력 실패:', error);
            return false; // 자동 입력 실패
        }
    }

    /**
     * 토스트 메시지 표시
     */
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    /**
     * 주기적 업데이트 시작
     */
    startPeriodicUpdate() {
        this.updateInterval = setInterval(async () => {
            await this.updateAllOTPCodes();
            this.updateAllTimeProgress();
        }, 1000);
    }

    /**
     * 모든 OTP 코드 업데이트
     */
    async updateAllOTPCodes() {
        const accountItems = document.querySelectorAll('.account-item');
        
        for (const item of accountItems) {
            const accountId = item.dataset.accountId;
            const account = this.accounts.find(acc => acc.id === accountId);
            
            if (account) {
                const otpCode = await this.totp.generateTOTP(account.secret);
                const otpElement = item.querySelector('.otp-code');
                
                if (otpElement && otpCode) {
                    otpElement.textContent = otpCode;
                }
            }
        }
    }

    /**
     * 모든 시간 진행 바 업데이트
     */
    updateAllTimeProgress() {
        const accountItems = document.querySelectorAll('.account-item');
        
        accountItems.forEach(item => {
            this.updateTimeProgress(item);
        });
    }

    /**
     * 고유 ID 생성
     */
    generateId() {
        return 'acc_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }
}

// 팝업이 로드되면 초기화
document.addEventListener('DOMContentLoaded', () => {
    new AuthenticatorPopup();
}); 