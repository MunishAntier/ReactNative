import { StyleSheet } from 'react-native';

export const SETTINGS_BG = '#EBEBEC';

const settingsCommon = StyleSheet.create({
    root: { flex: 1, backgroundColor: SETTINGS_BG },
    scroll: { flex: 1, paddingHorizontal: 16 },
    sectionTitle: {
        fontFamily: 'Gilroy-Medium',
        fontSize: 18,
        color: '#0230F9',
        marginTop: 20,
        marginBottom: 10,
        marginLeft: 4,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        paddingHorizontal: 16,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
    },
    border: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#D4D4D4',
    },
    textCol: { flex: 1, marginRight: 12 },
    label: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 15,
        color: '#070707',
    },
    subtitle: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 12,
        color: '#8E8E93',
        marginTop: 2,
    },
    note: {
        fontFamily: 'Gilroy-Regular',
        fontSize: 12,
        color: '#8E8E93',
        lineHeight: 18,
        marginTop: 8,
        marginLeft: 4,
    },
    link: {
        color: '#0230F9',
        fontFamily: 'Gilroy-Medium',
    },
});

export default settingsCommon;
