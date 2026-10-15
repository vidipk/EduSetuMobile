import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton, AppCard, AppText } from '@/design-system/components';
import { colors, radius, spacing } from '@/design-system/tokens';
import { Chips } from '@/features/performance/components';

import { type OptionDraft } from './logic';
import { ButtonRow, ErrorList, Field } from './ui';

export interface EditableQuestion {
  type: string;
  text: string;
  marks: string;
  options: OptionDraft[];
  correctOptionId: string;
  correctBool: boolean | null;
  correctText?: string;
}

/**
 * One editor for homework and quiz questions. The caller decides which types are
 * offered and supplies the validation messages to show.
 */
export function QuestionEditor<Q extends EditableQuestion>({ index, question, types, errors, showCorrectText, onChange, onChangeType, onRemove }: {
  index: number;
  question: Q;
  types: { id: string; label: string }[];
  errors: string[];
  showCorrectText?: boolean;
  onChange: (next: Q) => void;
  onChangeType: (type: string) => void;
  onRemove?: () => void;
}) {
  const label = `Question ${index + 1}`;
  const setOption = (id: string, text: string) => onChange({ ...question, options: question.options.map((option) => (option.id === id ? { ...option, text } : option)) });
  return (
    <AppCard style={styles.card}>
      <View style={styles.head}>
        <AppText style={styles.title}>{label}</AppText>
        {onRemove ? <AppButton title="Remove" accessibilityLabel={`Remove ${label}`} onPress={onRemove} /> : null}
      </View>
      <Chips label={`${label} type`} options={types} value={question.type} onChange={onChangeType} />
      <Field label={`${label} text`} value={question.text} onChangeText={(text) => onChange({ ...question, text })} multiline placeholder="Type the question" />
      <Field label={`${label} marks`} value={question.marks} onChangeText={(marks) => onChange({ ...question, marks })} keyboardType="decimal-pad" maxLength={7} />

      {question.type === 'MCQ' ? (
        <View style={styles.options}>
          <AppText style={styles.sub}>Options — select the correct one</AppText>
          {question.options.map((option) => {
            const correct = question.correctOptionId === option.id;
            return (
              <View key={option.id} style={styles.optionRow}>
                <Pressable accessibilityRole="radio" accessibilityState={{ checked: correct }} accessibilityLabel={`${label}: option ${option.id.toUpperCase()} is ${correct ? 'the correct answer' : 'not marked correct'}`} onPress={() => onChange({ ...question, correctOptionId: option.id })} style={[styles.radio, correct && styles.radioOn]}>
                  <AppText style={[styles.radioText, correct && styles.radioTextOn]}>{correct ? '✓' : option.id.toUpperCase()}</AppText>
                </Pressable>
                <View style={styles.optionField}>
                  <Field label={`${label} option ${option.id.toUpperCase()}`} value={option.text} onChangeText={(text) => setOption(option.id, text)} />
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {question.type === 'TRUE_FALSE' ? (
        <Chips label={`${label} correct answer`} options={[{ id: 'true', label: 'True' }, { id: 'false', label: 'False' }]} value={question.correctBool === null ? '' : String(question.correctBool)} onChange={(value) => onChange({ ...question, correctBool: value === 'true' })} />
      ) : null}

      {showCorrectText && (question.type === 'ONE_WORD_ANSWER' || question.type === 'FILL_IN_THE_BLANK') ? (
        <Field label={`${label} correct answer`} value={question.correctText ?? ''} onChangeText={(correctText) => onChange({ ...question, correctText })} autoCapitalize="none" />
      ) : null}

      <ErrorList errors={errors} />
    </AppCard>
  );
}

export function AddQuestionRow({ types, onAdd }: { types: { id: string; label: string }[]; onAdd: (type: string) => void }) {
  return (
    <View style={styles.options}>
      <AppText style={styles.sub}>Add a question</AppText>
      <ButtonRow>
        {types.map((type) => <AppButton key={type.id} title={`+ ${type.label}`} onPress={() => onAdd(type.id)} />)}
      </ButtonRow>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  head: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '800' },
  sub: { color: colors.muted, fontWeight: '600' },
  options: { gap: spacing.sm },
  optionRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  optionField: { flex: 1 },
  radio: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, height: 48, justifyContent: 'center', marginTop: 22, width: 48 },
  radioOn: { backgroundColor: colors.success, borderColor: colors.success },
  radioText: { color: colors.text, fontWeight: '700' },
  radioTextOn: { color: '#fff' },
});
