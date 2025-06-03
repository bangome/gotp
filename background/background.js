/**
 * G-OTP Chrome Extension - Background Script
 * Service Worker for Manifest V3
 */

class AuthenticatorBackground {
    constructor() {
        this.init();
    }

    init() {
        this.setupInstallHandler();
        this.setupMessageHandler();
        this.setupTabUpdateHandler();
    }

    /**
     * Extension 설치/업데이트 처리
     */
    setupInstallHandler() {
        chrome.runtime.onInstalled.addListener((details) => {
            console.log('G-OTP Extension이 설치되었습니다.');
            
            if (details.reason === 'install') {
                // 첫 설치 시
                console.log('설치가 완료되었습니다! 계정을 추가하여 시작하세요.');
            } else if (details.reason === 'update') {
                // 업데이트 시
                console.log('Extension이 업데이트되었습니다.');
            }
        });
    }

    /**
     * 메시지 핸들러 설정
     */
    setupMessageHandler() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'getAccounts':
                    this.handleGetAccounts(sendResponse);
                    break;
                case 'saveAccount':
                    this.handleSaveAccount(request.account, sendResponse);
                    break;
                case 'deleteAccount':
                    this.handleDeleteAccount(request.accountId, sendResponse);
                    break;
                case 'generateOTP':
                    this.handleGenerateOTP(request.secret, sendResponse);
                    break;
                case 'checkGooglePage':
                    this.handleCheckGooglePage(sender.tab, sendResponse);
                    break;
                default:
                    console.log('알 수 없는 액션:', request.action);
            }
            return true; // 비동기 응답을 위해 true 반환
        });
    }

    /**
     * 탭 업데이트 감지
     */
    setupTabUpdateHandler() {
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url) {
                if (tab.url.includes('accounts.google.com')) {
                    // Google 로그인 페이지에서 뱃지 표시
                    this.setBadge('OTP', '#4285f4');
                } else {
                    // 다른 페이지에서는 뱃지 제거
                    this.clearBadge();
                }
            }
        });
    }

    /**
     * 계정 목록 가져오기
     */
    async handleGetAccounts(sendResponse) {
        try {
            const result = await chrome.storage.sync.get(['accounts']);
            sendResponse({ success: true, accounts: result.accounts || [] });
        } catch (error) {
            console.error('계정 로드 오류:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * 계정 저장
     */
    async handleSaveAccount(account, sendResponse) {
        try {
            const result = await chrome.storage.sync.get(['accounts']);
            const accounts = result.accounts || [];
            
            const existingIndex = accounts.findIndex(acc => acc.id === account.id);
            if (existingIndex !== -1) {
                accounts[existingIndex] = account;
            } else {
                accounts.push(account);
            }
            
            await chrome.storage.sync.set({ accounts });
            sendResponse({ success: true });
        } catch (error) {
            console.error('계정 저장 오류:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * 계정 삭제
     */
    async handleDeleteAccount(accountId, sendResponse) {
        try {
            const result = await chrome.storage.sync.get(['accounts']);
            const accounts = result.accounts || [];
            
            const filteredAccounts = accounts.filter(acc => acc.id !== accountId);
            await chrome.storage.sync.set({ accounts: filteredAccounts });
            
            sendResponse({ success: true });
        } catch (error) {
            console.error('계정 삭제 오류:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * OTP 생성
     */
    async handleGenerateOTP(secret, sendResponse) {
        try {
            // TOTP 라이브러리를 동적으로 로드해야 하므로
            // 여기서는 popup에서 처리하도록 전달
            sendResponse({ success: true, message: 'Use popup for OTP generation' });
        } catch (error) {
            console.error('OTP 생성 오류:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Google 페이지 확인
     */
    handleCheckGooglePage(tab, sendResponse) {
        const isGooglePage = tab.url && tab.url.includes('accounts.google.com');
        sendResponse({ isGooglePage });
    }

    /**
     * 뱃지 설정
     */
    setBadge(text, color) {
        try {
            chrome.action.setBadgeText({ text });
            chrome.action.setBadgeBackgroundColor({ color });
        } catch (error) {
            console.log('뱃지 설정 오류:', error);
        }
    }

    /**
     * 뱃지 제거
     */
    clearBadge() {
        try {
            chrome.action.setBadgeText({ text: '' });
        } catch (error) {
            console.log('뱃지 제거 오류:', error);
        }
    }

    /**
     * 스토리지 암호화 (보안 강화)
     */
    async encryptData(data) {
        // 실제 구현에서는 더 강력한 암호화를 사용해야 함
        // 현재는 Base64 인코딩만 사용 (예시)
        try {
            const jsonString = JSON.stringify(data);
            return btoa(jsonString);
        } catch (error) {
            console.error('데이터 암호화 오류:', error);
            return data;
        }
    }

    /**
     * 스토리지 복호화
     */
    async decryptData(encryptedData) {
        try {
            const jsonString = atob(encryptedData);
            return JSON.parse(jsonString);
        } catch (error) {
            console.error('데이터 복호화 오류:', error);
            return encryptedData;
        }
    }

    /**
     * 보안 저장 (암호화된 저장)
     */
    async secureSet(key, data) {
        try {
            const encryptedData = await this.encryptData(data);
            await chrome.storage.sync.set({ [key]: encryptedData });
        } catch (error) {
            console.error('보안 저장 오류:', error);
            throw error;
        }
    }

    /**
     * 보안 읽기 (복호화된 읽기)
     */
    async secureGet(key) {
        try {
            const result = await chrome.storage.sync.get([key]);
            if (result[key]) {
                return await this.decryptData(result[key]);
            }
            return null;
        } catch (error) {
            console.error('보안 읽기 오류:', error);
            return null;
        }
    }
}

// Background Script 초기화
new AuthenticatorBackground(); 