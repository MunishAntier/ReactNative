import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ScrollView,
    Switch,
    useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import CustomToggle from '../components/common/CustomToggle';
import { Modal, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import BlueArrowIcon from '../assets/icons/BlueArrowIcon';

interface Props {
    user: {
        name: string;
        avatar?: any;
    };
    onBack: () => void;
}

const AboutUserScreen: React.FC<Props> = ({ user, onBack }) => {
    const [disappearingMessages, setDisappearingMessages] = React.useState(false);
    const [showDisappearingModal, setShowDisappearingModal] = React.useState(false);
    const [selectedDuration, setSelectedDuration] = React.useState('Off');

    const durations = [
        '5 seconds',
        '30 seconds',
        '1 minute',
        '1 hour',
        '1 day',
        '1 week',
        'Off',
    ];

    const handleToggleDisappearing = (val: boolean) => {
        setDisappearingMessages(val);
        if (val) {
            setShowDisappearingModal(true);
        }
    };

    return (
        <View style={styles.container}>
            {/* Hero Section */}
            <View style={styles.hero}>
                <View style={styles.headerRow}>
                    <TouchableOpacity style={styles.backButton} onPress={onBack}>
                        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>

                <View style={styles.heroContent}>
                    <Image
                        source={user.avatar || require('../assets/images/avatar.png')}
                        style={styles.avatar}
                    />
                    <Text style={styles.userName}>{user.name}</Text>

                    <View style={styles.actionRow}>
                        <View style={styles.actionItem}>
                            <TouchableOpacity style={styles.actionCircle}>
                                <Ionicons name="videocam-outline" size={22} color="#111111" />
                            </TouchableOpacity>
                            <Text style={styles.actionLabel}>Video</Text>
                        </View>
                        <View style={styles.actionItem}>
                            <TouchableOpacity style={styles.actionCircle}>
                                <Ionicons name="call-outline" size={22} color="#111111" />
                            </TouchableOpacity>
                            <Text style={styles.actionLabel}>Call</Text>
                        </View>
                        <View style={styles.actionItem}>
                            <TouchableOpacity style={styles.actionCircle}>
                                <Ionicons name="notifications-outline" size={22} color="#111111" />
                            </TouchableOpacity>
                            <Text style={styles.actionLabel}>Mute</Text>
                        </View>
                        <View style={styles.actionItem}>
                            <TouchableOpacity style={styles.actionCircle}>
                                <Ionicons name="search-outline" size={22} color="#111111" />
                            </TouchableOpacity>
                            <Text style={styles.actionLabel}>Search</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Settings List */}
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                <TouchableOpacity 
                    style={styles.listItem}
                    onPress={() => disappearingMessages && setShowDisappearingModal(true)}
                    activeOpacity={0.7}
                >
                    <View style={styles.itemIconBox}>
                        <MaterialCommunityIcons name="clock-outline" size={22} color="#111111" />
                    </View>
                    <Text style={styles.itemText}>Disappearing messages</Text>
                    <View style={styles.itemRight}>
                        {disappearingMessages && selectedDuration !== 'Off' && (
                            <Text style={styles.durationSummary}>{selectedDuration}</Text>
                        )}
                        <CustomToggle
                            value={disappearingMessages}
                            onValueChange={handleToggleDisappearing}
                        />
                    </View>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.listItem}
                    onPress={() => {}}
                >
                    <View style={styles.itemIconBox}>
                        <Ionicons name="pencil" size={20} color="#111111" />
                    </View>
                    <Text style={styles.itemText}>Nickname</Text>
                    <BlueArrowIcon />
                </TouchableOpacity>

                <TouchableOpacity style={styles.listItem}>
                    <View style={styles.itemIconBox}>
                        <Ionicons name="volume-medium" size={22} color="#111111" />
                    </View>
                    <Text style={styles.itemText}>Sounds & notifications</Text>
                    <BlueArrowIcon />
                </TouchableOpacity>

                <TouchableOpacity style={styles.listItem}>
                    <View style={styles.itemIconBox}>
                        <Ionicons name="phone-portrait" size={20} color="#111111" />
                    </View>
                    <Text style={styles.itemText}>Phone contact info</Text>
                    <BlueArrowIcon />
                </TouchableOpacity>

                <TouchableOpacity style={styles.listItem}>
                    <View style={styles.itemIconBox}>
                        <MaterialCommunityIcons name="shield-outline" size={22} color="#111111" />
                    </View>
                    <Text style={styles.itemText}>View safety number</Text>
                    <BlueArrowIcon />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.listItem, styles.dangerItem]}>
                    <View style={[styles.itemIconBox, styles.dangerIconBox]}>
                        <MaterialCommunityIcons name="block-helper" size={20} color="#FF3B30" />
                    </View>
                    <Text style={[styles.itemText, styles.dangerText]}>Block</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.listItem, styles.dangerItem]}>
                    <View style={[styles.itemIconBox, styles.dangerIconBox]}>
                        <MaterialCommunityIcons name="alert-outline" size={22} color="#FF3B30" />
                    </View>
                    <Text style={[styles.itemText, styles.dangerText]}>Report spam</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Disappearing Messages Modal */}
            <Modal
                visible={showDisappearingModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDisappearingModal(false)}
            >
                <Pressable 
                    style={styles.modalOverlay} 
                    onPress={() => setShowDisappearingModal(false)}
                >
                    <BlurView
                        intensity={30}
                        tint="dark"
                        style={StyleSheet.absoluteFill}
                    />
                    <Pressable style={styles.modalContent}>
                        <View style={styles.modalHandle} />
                        
                        <View style={styles.modalHeader}>
                            <View style={styles.disappearingIconBox}>
                                <MaterialCommunityIcons name="message-text-clock-outline" size={32} color="#FFFFFF" />
                            </View>
                            <Text style={styles.modalTitle}>Disappearing Messages</Text>
                            <Text style={styles.modalSubtitle}>
                                For more privacy, new messages will disappear for everyone after the selected duration.
                            </Text>
                        </View>

                        <View style={styles.durationList}>
                            {durations.map((duration) => (
                                <TouchableOpacity 
                                    key={duration}
                                    style={styles.durationItem}
                                    onPress={() => {
                                        setSelectedDuration(duration);
                                        if (duration === 'Off') {
                                            setDisappearingMessages(false);
                                        }
                                        setShowDisappearingModal(false);
                                    }}
                                >
                                    <Text style={[
                                        styles.durationText,
                                        selectedDuration === duration && styles.selectedDurationText
                                    ]}>
                                        {duration}
                                    </Text>
                                    {selectedDuration === duration && (
                                        <Ionicons name="checkmark" size={24} color="#4CD964" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    hero: {
        height: 322,
        backgroundColor: '#070707',
        paddingTop: 40,
        overflow: 'hidden',
    },
    headerRow: {
        height: 50,
        width: '100%',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    heroContent: {
        alignItems: 'center',
        marginTop: -10, // Pull up to match Figma alignment
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 20,
        marginBottom: 12,
    },
    userName: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 18,
        color: '#FFFFFF',
        marginBottom: 20,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 20,
    },
    actionItem: {
        alignItems: 'center',
        gap: 6,
    },
    actionCircle: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionLabel: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 11,
        color: '#FFFFFF',
        opacity: 0.8,
    },
    list: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    listContent: {
        paddingHorizontal: 24,
        paddingTop: 10,
        gap: 0,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 0.5,
        borderBottomColor: '#B5B5B5',
    },
    itemIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#F7F7F7',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    itemText: {
        flex: 1,
        fontFamily: 'Gilroy-Regular',
        fontSize: 14,
        color: '#070707',
    },
    itemRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    durationSummary: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 12,
        color: '#8e8e93',
    },
    dangerItem: {
        borderBottomWidth: 0,
    },
    dangerIconBox: {
        backgroundColor: '#FFE5E5',
    },
    dangerText: {
        color: '#FF3B30',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 24,
        paddingBottom: 40,
        maxHeight: '85%',
    },
    modalHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#000000',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 20,
        opacity: 0.1,
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    disappearingIconBox: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: '#0230F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 20,
        color: '#111111',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 14,
        color: '#8e8e93',
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 20,
    },
    durationList: {
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    durationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    durationText: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 16,
        color: '#111111',
    },
    selectedDurationText: {
        fontFamily: 'Gilroy-Medium',
        color: '#111111',
    },
});

export default AboutUserScreen;
