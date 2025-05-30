/**
 * TOTP (Time-based One-Time Password) 알고리즘 구현
 * RFC 6238 표준을 따름
 */

class TOTP {
  constructor() {
    this.timeStep = 30; // 30초 time window
    this.digits = 6; // 6자리 코드
  }

  /**
   * Base32 문자열을 Uint8Array로 디코딩
   */
  base32Decode(base32) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleanBase32 = base32.replace(/[^A-Z2-7]/g, '').toUpperCase();
    
    let bits = '';
    for (let i = 0; i < cleanBase32.length; i++) {
      const char = cleanBase32[i];
      const index = alphabet.indexOf(char);
      if (index === -1) continue;
      bits += index.toString(2).padStart(5, '0');
    }
    
    const bytes = [];
    for (let i = 0; i < bits.length - 7; i += 8) {
      const byte = parseInt(bits.substr(i, 8), 2);
      bytes.push(byte);
    }
    
    return new Uint8Array(bytes);
  }

  /**
   * 현재 시간 기반 time counter 생성
   */
  getTimeCounter(timestamp = null) {
    const time = timestamp || Math.floor(Date.now() / 1000);
    return Math.floor(time / this.timeStep);
  }

  /**
   * 숫자를 8바이트 배열로 변환 (Big Endian)
   */
  numberToBytes(number) {
    const bytes = new Uint8Array(8);
    for (let i = 7; i >= 0; i--) {
      bytes[i] = number & 0xff;
      number = Math.floor(number / 256);
    }
    return bytes;
  }

  /**
   * HMAC-SHA1 계산
   */
  async hmacSha1(key, data) {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
    return new Uint8Array(signature);
  }

  /**
   * Dynamic Truncation 수행
   */
  dynamicTruncation(hmacResult) {
    const offset = hmacResult[hmacResult.length - 1] & 0x0f;
    
    const binaryCode = 
      ((hmacResult[offset] & 0x7f) << 24) |
      ((hmacResult[offset + 1] & 0xff) << 16) |
      ((hmacResult[offset + 2] & 0xff) << 8) |
      (hmacResult[offset + 3] & 0xff);
    
    return binaryCode % Math.pow(10, this.digits);
  }

  /**
   * TOTP 코드 생성
   */
  async generateTOTP(secret, timestamp = null) {
    try {
      const key = this.base32Decode(secret);
      const timeCounter = this.getTimeCounter(timestamp);
      const timeBytes = this.numberToBytes(timeCounter);
      
      const hmacResult = await this.hmacSha1(key, timeBytes);
      const code = this.dynamicTruncation(hmacResult);
      
      return code.toString().padStart(this.digits, '0');
    } catch (error) {
      console.error('TOTP 생성 오류:', error);
      return null;
    }
  }

  /**
   * 다음 코드 생성까지 남은 시간 (초)
   */
  getTimeRemaining() {
    const now = Math.floor(Date.now() / 1000);
    return this.timeStep - (now % this.timeStep);
  }

  /**
   * 남은 시간 비율 (0-1)
   */
  getTimeRemainingRatio() {
    return this.getTimeRemaining() / this.timeStep;
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TOTP;
} else {
  window.TOTP = TOTP;
} 