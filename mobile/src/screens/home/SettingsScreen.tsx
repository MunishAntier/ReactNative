import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/rootReducer';
import ScreenHeader from '../../components/common/ScreenHeader';
import BottomNavBar, { TabKey } from '../../components/common/BottomNavBar';
import CustomToggle from '../../components/common/CustomToggle';
import SettingsMenuItem from '../../components/common/SettingsMenuItem';

const PROFILE_AVATAR = require('../../assets/images/profile_avatar.png');
const { width: SW } = Dimensions.get('window');

interface Props {
  onBack: () => void;
  onTabPress?: (key: TabKey) => void;
  onAccountPress?: () => void;
  onChatsPress?: () => void;
  onNotificationsPress?: () => void;
  onHelpPress?: () => void;
  onPrivacyPress?: () => void;
  onDataStoragePress?: () => void;
  onStoriesPress?: () => void;
  onLinkedDevicesPress?: () => void;
  onInviteFriendsPress?: () => void;
}

const MENU_ITEMS = [
  { icon: 'person-outline', label: 'Account' },
  { icon: 'git-compare-outline', label: 'Linked devices' },
  { icon: 'checkmark-circle-outline', label: 'Chats' },
  { icon: 'copy-outline', label: 'Stories' },
  { icon: 'notifications-outline', label: 'Notifications' },
  { icon: 'lock-closed-outline', label: 'Privacy' },
  { icon: 'time-outline', label: 'Backups' },
  { icon: 'heart-outline', label: 'Data and storage' },
  { icon: 'card-outline', label: 'Payments' },
  { icon: 'help-circle-outline', label: 'Help' },
  { icon: 'person-add-outline', label: 'Invite your friends' },
];

const SettingsScreen: React.FC<Props> = ({
  onBack,
  onTabPress,
  onAccountPress,
  onChatsPress,
  onNotificationsPress,
  onHelpPress,
  onPrivacyPress,
  onDataStoragePress,
  onStoriesPress,
  onLinkedDevicesPress,
  onInviteFriendsPress,
}) => {
  const [darkMode, setDarkMode] = useState(true);
  const { userInfo } = useSelector((state: RootState) => state.profile);

  const displayName = userInfo?.profile?.encrypted_name || 'Ronald Richards';
  const email = userInfo?.email || 'ronaldrichards@gmail.com';

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <ScreenHeader title="Setting" onBack={onBack} backgroundColor={BG} />

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Profile banner ── */}
        <ProfileBanner name={displayName} email={email} />

        {/* ── Menu rows ── */}
        <View style={s.list}>
          {/* Account */}
          <SettingsMenuItem
            icon="person-outline"
            label="Account"
            onPress={onAccountPress}
          />

          {/* Dark/Light toggle */}
          <SettingsMenuItem
            icon="contrast-outline"
            label="Dark/Light"
            showArrow={false}
            rightComponent={
              <CustomToggle value={darkMode} onValueChange={setDarkMode} />
            }
          />

          {/* Remaining items */}
          {MENU_ITEMS.slice(1).map((item, i) => (
            <SettingsMenuItem
              key={item.label}
              icon={item.icon}
              label={item.label}
              isLast={i === MENU_ITEMS.length - 2}
              onPress={
                item.label === 'Linked devices'
                  ? onLinkedDevicesPress
                  : item.label === 'Chats'
                  ? onChatsPress
                  : item.label === 'Stories'
                  ? onStoriesPress
                  : item.label === 'Notifications'
                  ? onNotificationsPress
                  : item.label === 'Privacy'
                  ? onPrivacyPress
                  : item.label === 'Data and storage'
                  ? onDataStoragePress
                  : item.label === 'Help'
                  ? onHelpPress
                  : item.label === 'Invite your friends'
                  ? onInviteFriendsPress
                  : undefined
              }
            />
          ))}
        </View>

        <View style={{ height: 130 }} />
      </ScrollView>

      <View style={s.navWrap}>
        <BottomNavBar activeTab="settings" onTabPress={k => onTabPress?.(k)} />
      </View>
    </View>
  );
};

/* ─── Profile Banner ───────────────────────────────────────────────────────── */
const ProfileBanner: React.FC<{
  name: string;
  email: string;
  avatar?: any;
}> = ({ name, email, avatar }) => (
  <View style={s.banner}>
    {/* Background: dark base + blue glow */}
    <LinearGradient
      colors={['#06060F', '#080C1E', '#0E1A3D']}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={StyleSheet.absoluteFill}
    />
    {/* Bright blue glow on right */}
    <View style={s.glowOuter} />
    <View style={s.glowInner} />

    {/* Content */}
    <View style={s.bannerContent}>
      <Image source={avatar || PROFILE_AVATAR} style={s.avatar} />
      <View style={s.infoCol}>
        <Text style={s.name}>{name}</Text>
        <Text style={s.email}>{email}</Text>
        <TouchableOpacity style={s.editBtn} activeOpacity={0.7}>
          <Ionicons name="create-outline" size={13} color="#B0B0B0" />
          <Text style={s.editLabel}>Edit Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

/* ─── Constants & Styles ───────────────────────────────────────────────────── */
const BG = '#EBEBEC';

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },

  /* Banner */
  banner: {
    width: SW,
    height: 144,
    overflow: 'hidden',
  },
  glowOuter: {
    position: 'absolute',
    right: -60,
    top: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#1B3FA0',
    opacity: 0.35,
  },
  glowInner: {
    position: 'absolute',
    right: -10,
    top: 10,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#2B5FDD',
    opacity: 0.25,
  },
  bannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 22,
    marginRight: 16,
  },
  infoCol: { flex: 1, gap: 2 },
  name: {
    fontFamily: 'Gilroy-Medium',
    fontSize: 20,
    color: '#FFFFFF',
  },
  email: {
    fontFamily: 'Gilroy-Regular',
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  editLabel: {
    fontFamily: 'Gilroy-Regular',
    fontSize: 13,
    color: '#B0B0B0',
  },

  /* Menu list */
  list: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 18,
    paddingHorizontal: 16,
  },

  /* Nav */
  navWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});

export default SettingsScreen;
