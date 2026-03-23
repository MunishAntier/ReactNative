import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Modal,
    Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import ScreenHeader from '../../components/common/ScreenHeader';
import SettingsMenuItem from '../../components/common/SettingsMenuItem';
import CustomToggle from '../../components/common/CustomToggle';
import BottomSheetModal from '../../components/common/BottomSheetModal';

interface Props {
    onBack: () => void;
    onChangePin?: () => void;
    onChangeNumber?: () => void;
    onDeleteAccount?: () => void;
}

const AccountScreen: React.FC<Props> = ({ onBack, onChangePin, onChangeNumber, onDeleteAccount }) => {
    const [pinReminders, setPinReminders] = useState(true);
    const [registrationLock, setRegistrationLock] = useState(false);
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [showDisablePinModal, setShowDisablePinModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showDataModal, setShowDataModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    return (
        <View style={s.root}>
            <StatusBar barStyle="dark-content" backgroundColor={BG} />
            <ScreenHeader title="Account" onBack={onBack} backgroundColor={BG} />

            <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
                {/* ── Invest PIN ── */}
                <SectionTitle title="Invest PIN" />
                <View style={s.card}>
                    <SettingsMenuItem icon="keypad-outline" label="Change your PIN" onPress={onChangePin} />
                    <SettingsMenuItem
                        icon="keypad-outline"
                        label="PIN reminders"
                        subtitle="You'll be asked less frequently over time"
                        showArrow={false}
                        rightComponent={<CustomToggle value={pinReminders} onValueChange={setPinReminders} />}
                    />
                    <SettingsMenuItem
                        icon="lock-closed-outline"
                        label="Registration Lock"
                        subtitle="Require your Invest PIN to register your phone number with Invest again"
                        showArrow={false}
                        rightComponent={<CustomToggle value={registrationLock} onValueChange={setRegistrationLock} />}
                    />
                    <SettingsMenuItem icon="settings-outline" label="Advanced PIN Setting" showArrow={false} onPress={() => setShowDisablePinModal(true)} isLast />
                </View>

                {/* ── Account ── */}
                <SectionTitle title="Account" />
                <View style={s.card}>
                    <SettingsMenuItem icon="call-outline" label="Change phone number" onPress={() => setShowPhoneModal(true)} />
                    <SettingsMenuItem icon="swap-horizontal-outline" label="Transfer account" subtitle="Transfer account to a new Android device" onPress={() => setShowTransferModal(true)} />
                    <SettingsMenuItem icon="person-outline" label="Your account data" onPress={() => setShowDataModal(true)} />
                    <SettingsMenuItem icon="trash-outline" label="Delete Account" showArrow={false} danger isLast onPress={() => setShowDeleteModal(true)} />
                </View>

                <View style={{ height: 24 }} />
                <TouchableOpacity style={s.saveBtn} activeOpacity={0.85}>
                    <Text style={s.saveTxt}>Save</Text>
                </TouchableOpacity>
                <View style={{ height: 50 }} />
            </ScrollView>

            {/* ── Modals ── */}
            <BottomSheetModal
                visible={showPhoneModal}
                onClose={() => setShowPhoneModal(false)}
                icon="call-outline"
                title="Change phone number"
                description="Use this to change your current phone number to a new phone number. You can't undo this change. Before continuing, make sure your new number can receive SMS or calls."
                buttonTitle="Continue"
                onButtonPress={() => { setShowPhoneModal(false); onChangeNumber?.(); }}
            />
            <BottomSheetModal
                visible={showDisablePinModal}
                onClose={() => setShowDisablePinModal(false)}
                icon="git-compare-outline"
                title="Disable PIN"
                description="If you disable the PIN, you will lose all data when you re-register Invest unless you manually back up and restore. You can not turn on Registration lock while the PIN is disabled"
            />
            <BottomSheetModal
                visible={showTransferModal}
                onClose={() => setShowTransferModal(false)}
                icon="phone-portrait-outline"
                title="Transfer Account"
                bullets={[
                    'Download Invest on your new Android device',
                    'Top on transfer or restore account',
                    'Select Transfer from Android device when prompted and then Continue. keep both devices nearby',
                ]}
                buttonTitle="Continue"
                onButtonPress={() => setShowTransferModal(false)}
            />
            <AccountDataModal visible={showDataModal} onClose={() => setShowDataModal(false)} />
            <DeleteAccountModal
                visible={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={() => { setShowDeleteModal(false); onDeleteAccount?.(); }}
            />
        </View>
    );
};

/* ── Section Title ─────────────────────────────────────────────────────────── */
const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
    <Text style={s.sectionTitle}>{title}</Text>
);

/* ── Account Data Modal ────────────────────────────────────────────────────── */
const AccountDataModal: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
    const [format, setFormat] = useState<'txt' | 'json'>('txt');

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={d.overlay} onPress={onClose}>
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                <Pressable style={d.sheet}>
                    <View style={d.handle} />
                    <TouchableOpacity style={d.closeBtn} onPress={onClose} activeOpacity={0.7}>
                        <Ionicons name="close-circle-outline" size={28} color="#8E8E93" />
                    </TouchableOpacity>

                    <View style={d.iconBox}>
                        <Ionicons name="document-text-outline" size={28} color="#FFFFFF" />
                    </View>
                    <Text style={d.title}>Your account data</Text>
                    <Text style={d.desc}>
                        Export a report of your Invest account data. This report does not include any messages or media.
                    </Text>
                    <TouchableOpacity activeOpacity={0.7}>
                        <Text style={d.link}>Learn more....</Text>
                    </TouchableOpacity>

                    {/* Radio options */}
                    <View style={d.options}>
                        <ExportOption
                            icon="download-outline"
                            label="Export as TXT"
                            subtitle="Easy-to-read text file"
                            selected={format === 'txt'}
                            onPress={() => setFormat('txt')}
                        />
                        <ExportOption
                            icon="download-outline"
                            label="Export as JSON"
                            subtitle="Machine-readable file"
                            selected={format === 'json'}
                            onPress={() => setFormat('json')}
                        />
                    </View>

                    <TouchableOpacity style={d.btn} onPress={onClose} activeOpacity={0.85}>
                        <Text style={d.btnTxt}>Export Report</Text>
                    </TouchableOpacity>

                    <Text style={d.footer}>
                        Your report is generated only at the time of export and is not stored by Invest on your device.
                    </Text>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

/* ── Export Option Row ──────────────────────────────────────────────────────── */
interface ExportOptionProps {
    icon: string;
    label: string;
    subtitle: string;
    selected: boolean;
    onPress: () => void;
}

const ExportOption: React.FC<ExportOptionProps> = ({ icon, label, subtitle, selected, onPress }) => (
    <TouchableOpacity style={d.optionRow} onPress={onPress} activeOpacity={0.7}>
        <View style={d.optionIcon}>
            <Ionicons name={icon as any} size={20} color="#070707" />
        </View>
        <View style={d.optionText}>
            <Text style={d.optionLabel}>{label}</Text>
            <Text style={d.optionSub}>{subtitle}</Text>
        </View>
        <View style={[d.radio, selected && d.radioSelected]}>
            {selected && <View style={d.radioDot} />}
        </View>
    </TouchableOpacity>
);

/* ── Delete Account Modal ──────────────────────────────────────────────────── */
const DeleteAccountModal: React.FC<{ visible: boolean; onClose: () => void; onConfirm: () => void }> = ({ visible, onClose, onConfirm }) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={d.overlay} onPress={onClose}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <Pressable style={d.sheet}>
                <View style={d.handle} />
                <TouchableOpacity style={d.closeBtn} onPress={onClose} activeOpacity={0.7}>
                    <Ionicons name="close-circle-outline" size={28} color="#8E8E93" />
                </TouchableOpacity>

                <View style={[d.iconBox, { backgroundColor: '#FF3B30' }]}>
                    <Ionicons name="trash-outline" size={28} color="#FFFFFF" />
                </View>
                <Text style={d.title}>Deleting your account</Text>
                <Text style={d.desc}>
                    If you wish to permanently delete your account and all associated data, please click the link below and submit your request.
                </Text>

                <View style={del.btnRow}>
                    <TouchableOpacity style={del.noBtn} onPress={onClose} activeOpacity={0.85}>
                        <Text style={del.noTxt}>No</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={del.yesBtn} onPress={onConfirm} activeOpacity={0.85}>
                        <Text style={del.yesTxt}>Yes</Text>
                    </TouchableOpacity>
                </View>
            </Pressable>
        </Pressable>
    </Modal>
);

/* ── Styles ────────────────────────────────────────────────────────────────── */
const BG = '#EBEBEC';

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: BG },
    scroll: { flex: 1, paddingHorizontal: 16 },
    sectionTitle: { fontFamily: 'Gilroy-Medium', fontSize: 18, color: '#0230F9', marginTop: 20, marginBottom: 10, marginLeft: 4 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 16 },
    saveBtn: { backgroundColor: '#070707', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    saveTxt: { fontFamily: 'Gilroy-Medium', fontSize: 16, color: '#FFFFFF' },
});

const d = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingBottom: 34,
        alignItems: 'center',
    },
    handle: { width: 40, height: 4, backgroundColor: '#000', borderRadius: 2, opacity: 0.15, marginTop: 12, marginBottom: 16 },
    closeBtn: { position: 'absolute', top: 16, right: 20 },
    iconBox: { width: 60, height: 60, borderRadius: 16, backgroundColor: '#0230F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16, marginTop: 8 },
    title: { fontFamily: 'Gilroy-Medium', fontSize: 20, color: '#070707', marginBottom: 10 },
    desc: { fontFamily: 'Gilroy-Regular', fontSize: 14, color: '#8E8E93', textAlign: 'center', lineHeight: 20, paddingHorizontal: 10 },
    link: { fontFamily: 'Gilroy-Medium', fontSize: 14, color: '#0230F9', marginTop: 4, marginBottom: 20 },
    options: { width: '100%', gap: 0 },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#D4D4D4',
    },
    optionIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#F2F2F3',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    optionText: { flex: 1 },
    optionLabel: { fontFamily: 'Gilroy-Medium', fontSize: 15, color: '#070707' },
    optionSub: { fontFamily: 'Gilroy-Regular', fontSize: 12, color: '#8E8E93', marginTop: 2 },
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#C0C0C0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioSelected: { borderColor: '#0230F9' },
    radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#0230F9' },
    btn: { width: '100%', backgroundColor: '#070707', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
    btnTxt: { fontFamily: 'Gilroy-Medium', fontSize: 16, color: '#FFFFFF' },
    footer: { fontFamily: 'Gilroy-Regular', fontSize: 12, color: '#8E8E93', textAlign: 'center', lineHeight: 18, marginTop: 12, paddingHorizontal: 10 },
});

const del = StyleSheet.create({
    btnRow: { flexDirection: 'row', width: '100%', gap: 12, marginTop: 20 },
    noBtn: { flex: 1, height: 52, borderRadius: 14, borderWidth: 1, borderColor: '#D4D4D4', alignItems: 'center', justifyContent: 'center' },
    noTxt: { fontFamily: 'Gilroy-Medium', fontSize: 16, color: '#070707' },
    yesBtn: { flex: 1, height: 52, borderRadius: 14, backgroundColor: '#070707', alignItems: 'center', justifyContent: 'center' },
    yesTxt: { fontFamily: 'Gilroy-Medium', fontSize: 16, color: '#FFFFFF' },
});

export default AccountScreen;
