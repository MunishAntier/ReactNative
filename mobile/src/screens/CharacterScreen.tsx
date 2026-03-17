import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    FlatList,
    Dimensions,
    ImageSourcePropType,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import FooterSection from '../components/common/FooterSection';

const { width: SCREEN_W } = Dimensions.get('window');

const MAIN_AVATAR = require('../assets/images/mainAvatar.png');

const AVATAR_SOURCES: ImageSourcePropType[] = [
    require('../assets/images/1.png'),
    require('../assets/images/2.png'),
    require('../assets/images/3.png'),
    require('../assets/images/4.png'),
    require('../assets/images/5.png'),
    require('../assets/images/6.png'),
    require('../assets/images/7.png'),
    require('../assets/images/8.png'),
    require('../assets/images/9.png'),
];

const GRID_PADDING = 24;
const GRID_GAP = 16;
const NUM_COLUMNS = 3;
const CELL_SIZE = (SCREEN_W - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

interface CharacterScreenProps {
    onClose: () => void;
}

const CharacterScreen: React.FC<CharacterScreenProps> = ({ onClose }) => {
    const insets = useSafeAreaInsets();
    const [selectedIndex, setSelectedIndex] = useState(-1);

    const handleCameraPress = () => {
        // No action yet
    };

    const handlePhotoPress = () => {
        // No action yet
    };

    const handleSave = () => {
        // No action yet
    };

    const previewSource = selectedIndex >= 0 ? AVATAR_SOURCES[selectedIndex] : MAIN_AVATAR;

    const renderAvatarItem = ({ item, index }: { item: ImageSourcePropType; index: number }) => {
        const isSelected = index === selectedIndex;
        return (
            <TouchableOpacity
                style={[
                    styles.gridCell,
                    {
                        width: CELL_SIZE,
                        height: CELL_SIZE,
                        marginRight: (index + 1) % NUM_COLUMNS === 0 ? 0 : GRID_GAP,
                    },
                    isSelected && styles.gridCellSelected,
                ]}
                activeOpacity={0.7}
                onPress={() => setSelectedIndex(index)}
            >
                <Image
                    source={item}
                    style={styles.gridImage}
                    resizeMode="cover"
                />
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.root}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                {/* Close button */}
                <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={onClose}
                    activeOpacity={0.7}
                >
                    <Ionicons name="close" size={38} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Content */}
                <FlatList
                    data={AVATAR_SOURCES}
                    renderItem={renderAvatarItem}
                    keyExtractor={(_, i) => `avatar-${i}`}
                    numColumns={NUM_COLUMNS}
                    contentContainerStyle={styles.gridContent}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                        <View style={styles.headerSection}>
                            {/* Large selected avatar */}
                            <View style={styles.mainAvatarWrapper}>
                                <View style={styles.mainAvatarBg}>
                                    <Image
                                        source={previewSource}
                                        style={styles.mainAvatarImage}
                                        resizeMode="cover"
                                    />
                                </View>
                            </View>

                            {/* Camera / Photo buttons */}
                            <View style={styles.buttonRow}>
                                <TouchableOpacity
                                    style={styles.outlinedBtn}
                                    onPress={handleCameraPress}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.outlinedBtnText}>Camera</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.filledBtn}
                                    onPress={handlePhotoPress}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.filledBtnText}>Photo</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    }
                    columnWrapperStyle={styles.gridRow}
                />
            </SafeAreaView>

            {/* Footer with Save */}
            <FooterSection buttonTitle="Save" onButtonPress={handleSave} />
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#E4E9EC',
    },
    safeArea: {
        flex: 1,
    },
    closeBtn: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        alignSelf: 'flex-start',
    },
    headerSection: {
        alignItems: 'center',
        paddingTop: 16,
        paddingBottom: 24,
    },
    mainAvatarWrapper: {
        marginBottom: 24,
    },
    mainAvatarBg: {
        width: 160,
        height: 160,
        borderRadius: 24,
        backgroundColor: '#B190B6',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mainAvatarImage: {
        width: 160,
        height: 160,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: GRID_PADDING,
    },
    outlinedBtn: {
        flex: 1,
        height: 50,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#111111',
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    outlinedBtnText: {
        fontFamily: 'ClashDisplay-Regular',
        fontSize: 16,
        color: '#111111',
        letterSpacing: 0,
    },
    filledBtn: {
        flex: 1,
        height: 50,
        borderRadius: 12,
        backgroundColor: '#111111',
        alignItems: 'center',
        justifyContent: 'center',
    },
    filledBtnText: {
        fontFamily: 'ClashDisplay-Regular',
        fontSize: 16,
        color: '#FCFDFD',
        letterSpacing: 0,
    },
    gridContent: {
        paddingHorizontal: GRID_PADDING,
        paddingBottom: 24,
    },
    gridRow: {
        marginTop: GRID_GAP,
    },
    gridCell: {
        borderRadius: 18,
        backgroundColor: '#B190B6',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gridCellSelected: {
        borderWidth: 3,
        borderColor: '#1E2A78',
    },
    gridImage: {
        width: '100%',
        height: '100%',
    },
});

export default CharacterScreen;
