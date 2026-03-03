import AsyncStorage from '@react-native-async-storage/async-storage';

import type {EncryptedMessage, KeyBundleUpload, PeerKeyBundle, PreKeyPublic} from '../types';
import {base64ToUtf8, utf8ToBase64} from '../utils/base64';
import {randomID, randomInt} from '../utils/random';

const stateKey = 'securemsg.signal.state.v1';

interface SignalState {
  registrationId: number;
  identityPublicKey: string;
  identityKeyVersion: number;
  nextPreKeyID: number;
  nextSignedPreKeyID: number;
  currentSignedPreKeyID: number;
  currentSignedPreKeyPublic: string;
  currentSignedPreKeySignature: string;
  currentSignedPreKeyExpiresAt: string;
  knownSessions: Record<string, number>;
  pendingOneTimePreKeys: Record<string, number>;
  messageCounters: Record<string, number>;
}

export class PlainSignal {
  private state: SignalState | null = null;

  async init(): Promise<void> {
    await this.ensureLoaded();
  }

  async generateInitialBundle(oneTimePreKeyCount: number): Promise<KeyBundleUpload> {
    await this.ensureLoaded();
    const signed = await this.ensureSignedPreKey(false);
    const oneTimePreKeys = await this.generateOneTimePreKeys(oneTimePreKeyCount);

    return {
      registration_id: this.state!.registrationId,
      identity_public_key: this.state!.identityPublicKey,
      identity_key_version: this.state!.identityKeyVersion,
      signed_prekey_id: signed.id,
      signed_prekey_public: signed.public,
      signed_prekey_signature: signed.signature,
      signed_prekey_expires_at: signed.expiresAt,
      one_time_prekeys: oneTimePreKeys
    };
  }

  async generateOneTimePreKeys(count: number): Promise<PreKeyPublic[]> {
    await this.ensureLoaded();

    const total = Math.max(1, count);
    const start = Math.max(1, this.state!.nextPreKeyID);
    this.state!.nextPreKeyID = start + total;

    const items: PreKeyPublic[] = [];
    for (let offset = 0; offset < total; offset += 1) {
      const id = start + offset;
      items.push({
        prekey_id: id,
        prekey_public: `otpk-${id}-${randomID('pub')}`
      });
    }

    await this.persist();
    return items;
  }

  async rotateSignedPreKey(): Promise<{
    signedPreKeyID: number;
    signedPreKeyPublic: string;
    signedPreKeySignature: string;
    signedPreKeyExpiresAt: string;
  }> {
    await this.ensureLoaded();
    const signed = await this.ensureSignedPreKey(true);

    return {
      signedPreKeyID: signed.id,
      signedPreKeyPublic: signed.public,
      signedPreKeySignature: signed.signature,
      signedPreKeyExpiresAt: signed.expiresAt
    };
  }

  async initializeSession(peerUserID: number, bundle: PeerKeyBundle): Promise<void> {
    await this.ensureLoaded();

    this.state!.knownSessions[String(peerUserID)] = Math.max(1, bundle.identity_key_version || 1);
    this.state!.pendingOneTimePreKeys[String(peerUserID)] = bundle.one_time_prekey_id;
    await this.persist();
  }

  async hasSession(peerUserID: number): Promise<boolean> {
    await this.ensureLoaded();
    return this.state!.knownSessions[String(peerUserID)] !== undefined;
  }

  async invalidateSession(peerUserID: number): Promise<void> {
    await this.ensureLoaded();

    const key = String(peerUserID);
    delete this.state!.knownSessions[key];
    delete this.state!.pendingOneTimePreKeys[key];
    delete this.state!.messageCounters[key];
    await this.persist();
  }

  async encrypt(plaintext: string, peerUserID: number): Promise<EncryptedMessage> {
    await this.ensureLoaded();

    const key = String(peerUserID);
    const sessionVersion = this.state!.knownSessions[key];
    if (sessionVersion === undefined) {
      throw new Error('no session for peer');
    }

    const messageIndex = (this.state!.messageCounters[key] ?? 0) + 1;
    this.state!.messageCounters[key] = messageIndex;

    const reservedPreKey = this.state!.pendingOneTimePreKeys[key] ?? 0;
    delete this.state!.pendingOneTimePreKeys[key];

    await this.persist();

    return {
      ciphertextB64: utf8ToBase64(plaintext),
      header: {
        session_version: sessionVersion,
        sender_identity_pub_b64: this.state!.identityPublicKey,
        sender_ephemeral_pub_b64: `rn-eph-${randomID()}`,
        receiver_one_time_prekey_id: reservedPreKey,
        ratchet_pub_b64: `rn-ratchet-${randomID()}`,
        message_index: messageIndex
      }
    };
  }

  async decrypt(ciphertextB64: string, senderUserID: number): Promise<string> {
    await this.ensureLoaded();

    const senderKey = String(senderUserID);
    if (this.state!.knownSessions[senderKey] === undefined) {
      this.state!.knownSessions[senderKey] = 1;
      await this.persist();
    }

    return base64ToUtf8(ciphertextB64);
  }

  private async ensureLoaded(): Promise<void> {
    if (this.state) {
      return;
    }

    const raw = await AsyncStorage.getItem(stateKey);
    if (raw) {
      try {
        this.state = JSON.parse(raw) as SignalState;
      } catch {
        this.state = this.createDefaultState();
      }
    } else {
      this.state = this.createDefaultState();
    }

    await this.persist();
  }

  private createDefaultState(): SignalState {
    const now = Date.now();
    return {
      registrationId: randomInt(1, 16379),
      identityPublicKey: `identity-${randomID()}`,
      identityKeyVersion: 1,
      nextPreKeyID: 1,
      nextSignedPreKeyID: 2,
      currentSignedPreKeyID: 1,
      currentSignedPreKeyPublic: `spk-${randomID()}`,
      currentSignedPreKeySignature: `sig-${randomID()}`,
      currentSignedPreKeyExpiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
      knownSessions: {},
      pendingOneTimePreKeys: {},
      messageCounters: {}
    };
  }

  private async ensureSignedPreKey(forceRotate: boolean): Promise<{id: number; public: string; signature: string; expiresAt: string}> {
    await this.ensureLoaded();

    const expiresAtMillis = Date.parse(this.state!.currentSignedPreKeyExpiresAt);
    const stillValid = Number.isFinite(expiresAtMillis) && expiresAtMillis > Date.now();

    if (!forceRotate && stillValid) {
      return {
        id: this.state!.currentSignedPreKeyID,
        public: this.state!.currentSignedPreKeyPublic,
        signature: this.state!.currentSignedPreKeySignature,
        expiresAt: this.state!.currentSignedPreKeyExpiresAt
      };
    }

    const nextID = Math.max(1, this.state!.nextSignedPreKeyID);
    this.state!.currentSignedPreKeyID = nextID;
    this.state!.currentSignedPreKeyPublic = `spk-${randomID()}`;
    this.state!.currentSignedPreKeySignature = `sig-${randomID()}`;
    this.state!.currentSignedPreKeyExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    this.state!.nextSignedPreKeyID = nextID + 1;

    await this.persist();

    return {
      id: this.state!.currentSignedPreKeyID,
      public: this.state!.currentSignedPreKeyPublic,
      signature: this.state!.currentSignedPreKeySignature,
      expiresAt: this.state!.currentSignedPreKeyExpiresAt
    };
  }

  private async persist(): Promise<void> {
    if (!this.state) {
      return;
    }
    await AsyncStorage.setItem(stateKey, JSON.stringify(this.state));
  }
}
