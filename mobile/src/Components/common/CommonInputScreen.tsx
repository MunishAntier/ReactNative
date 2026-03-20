import React from 'react';
import {
    View,
    StyleSheet,
    StatusBar,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import ScreenHeader from './ScreenHeader';
import FooterSection from './FooterSection';

interface Props {
    title: string;
    onBack: () => void;
    onContinue: () => void;
    buttonTitle?: string;
    children: React.ReactNode;
}

const CommonInputScreen: React.FC<Props> = ({
    title,
    onBack,
    onContinue,
    buttonTitle = "Continue",
    children,
}) => {
    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.headerWrapper}>
                    <ScreenHeader
                        title={title}
                        onBack={onBack}
                    />
                </View>

                <View style={styles.body}>
                    {children}
                </View>

                <FooterSection
                    buttonTitle={buttonTitle}
                    onButtonPress={onContinue}
                />
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#EBEBEC',
    },
    flex: {
        flex: 1,
    },
    headerWrapper: {
        borderBottomWidth: 1,
        borderBottomColor: '#E3E3E3',
    },
    body: {
        flex: 1,
        backgroundColor: '#EBEBEC',
        paddingHorizontal: 24,
        paddingTop: 32,
    },
});

export default CommonInputScreen;
