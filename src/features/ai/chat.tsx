import { useRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppButton, AppText } from '@/design-system/components';
import { colors, radius, spacing } from '@/design-system/tokens';

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Extra assistant detail rendered under the text. */
  example?: string;
  practiceSuggestion?: string;
  followUps?: string[];
  sources?: { title: string; type: string }[];
  /** Assistant answers only: true when school material was used. */
  grounded?: boolean;
}

export function ChatBubble({ turn, onFollowUp, disabled }: { turn: ChatTurn; onFollowUp?: (question: string) => void; disabled?: boolean }) {
  const mine = turn.role === 'user';
  return (
    <View accessible accessibilityLabel={`${mine ? 'You' : 'AI tutor'}: ${turn.text}`} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
      <AppText style={mine ? styles.mineText : undefined}>{turn.text}</AppText>
      {turn.example ? <AppText style={styles.detail}>Example: {turn.example}</AppText> : null}
      {turn.practiceSuggestion ? <AppText style={styles.detail}>Try this: {turn.practiceSuggestion}</AppText> : null}
      {turn.role === 'assistant' && turn.grounded !== undefined ? (
        turn.grounded && turn.sources?.length ? (
          <View style={styles.sources}>
            <AppText style={styles.sourceTitle}>Sources from your school material</AppText>
            {turn.sources.map((source) => <AppText key={`${source.title}-${source.type}`} style={styles.detail}>• {source.title}</AppText>)}
          </View>
        ) : (
          <AppText style={styles.detail}>This answer is not based on your school material.</AppText>
        )
      ) : null}
      {turn.followUps?.length && onFollowUp ? (
        <View style={styles.followUps}>
          {turn.followUps.slice(0, 3).map((question) => (
            <Pressable key={question} accessibilityRole="button" accessibilityLabel={`Ask: ${question}`} disabled={disabled} onPress={() => onFollowUp(question)} style={styles.followUp}>
              <AppText style={styles.followUpText}>{question}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Scrollable conversation with a fixed input bar. */
export function ChatShell({ children, input, onInput, onSend, sending, onCancel, placeholder, disabled }: {
  children: React.ReactNode;
  input: string;
  onInput: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  onCancel: () => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const scroll = useRef<ScrollView>(null);
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView ref={scroll} testID="chat-scroll" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        {children}
      </ScrollView>
      <View style={styles.inputBar}>
        <TextInput
          accessibilityLabel="Message"
          editable={!disabled && !sending}
          maxLength={2000}
          multiline
          onChangeText={onInput}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={input}
        />
        {sending ? <AppButton title="Stop" onPress={onCancel} /> : <AppButton title="Send" disabled={disabled || !input.trim()} onPress={onSend} />}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xl },
  bubble: { borderRadius: radius.md, gap: spacing.sm, maxWidth: '92%', padding: spacing.md },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  mineText: { color: '#fff' },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#EEF3F2' },
  detail: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  sources: { gap: 2 },
  sourceTitle: { fontSize: 12, fontWeight: '700' },
  followUps: { gap: spacing.xs },
  followUp: { borderColor: colors.primary, borderRadius: radius.md, borderWidth: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  followUpText: { color: colors.primary, fontSize: 14 },
  inputBar: { alignItems: 'flex-end', borderColor: colors.border, borderTopWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  input: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, flex: 1, fontSize: 16, maxHeight: 120, minHeight: 48, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
