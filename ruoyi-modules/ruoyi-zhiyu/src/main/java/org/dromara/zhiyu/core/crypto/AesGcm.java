package org.dromara.zhiyu.core.crypto;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * 租户敏感配置（AI api_key）对称加解密，与 Go 版 {@code internal/crypto/aes.go} 完全对齐：
 * AES-256-GCM，密钥由 secret 经 SHA-256 派生，输出 base64(nonce|ciphertext)。
 * 两栈共享同一 PostgreSQL，密文必须可互解。
 *
 * @author zhiyu
 */
public final class AesGcm {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int NONCE_SIZE = 12;
    private static final int TAG_BITS = 128;

    private AesGcm() {
    }

    public static String encrypt(String secret, String plaintext) throws Exception {
        byte[] key = sha256(secret);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        byte[] nonce = new byte[NONCE_SIZE];
        RANDOM.nextBytes(nonce);
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(TAG_BITS, nonce));
        byte[] ct = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
        byte[] sealed = new byte[nonce.length + ct.length];
        System.arraycopy(nonce, 0, sealed, 0, nonce.length);
        System.arraycopy(ct, 0, sealed, nonce.length, ct.length);
        return Base64.getEncoder().encodeToString(sealed);
    }

    public static String decrypt(String secret, String token) throws Exception {
        byte[] raw = Base64.getDecoder().decode(token);
        byte[] key = sha256(secret);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        byte[] nonce = new byte[NONCE_SIZE];
        System.arraycopy(raw, 0, nonce, 0, NONCE_SIZE);
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(TAG_BITS, nonce));
        byte[] pt = cipher.doFinal(raw, NONCE_SIZE, raw.length - NONCE_SIZE);
        return new String(pt, StandardCharsets.UTF_8);
    }

    private static byte[] sha256(String s) throws Exception {
        return MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
    }
}
