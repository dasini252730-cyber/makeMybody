import type { Database } from '@/types/supabase'

// 생성 타입(src/types/supabase.ts)에서 자주 쓰는 모양을 짧게 부르는 헬퍼 (T-022).
// 예: Row<'workout_sessions'>, Insert<'exercise_sets'>, ViewRow<'v_working_sets'>
export type Schema = Database['mybody']
export type TableName = keyof Schema['Tables']
export type ViewName = keyof Schema['Views']

export type Row<T extends TableName> = Schema['Tables'][T]['Row']
export type Insert<T extends TableName> = Schema['Tables'][T]['Insert']
export type Update<T extends TableName> = Schema['Tables'][T]['Update']
export type ViewRow<V extends ViewName> = Schema['Views'][V]['Row']

// 자주 쓰는 도메인 별칭
export type WorkoutSession = Row<'workout_sessions'>
export type SessionItem = Row<'session_items'>
export type ExerciseSet = Row<'exercise_sets'>
export type Exercise = Row<'exercise_library'>
export type BodyMetric = Row<'body_metrics'>
export type RecoveryLog = Row<'recovery_logs'>
export type ActivityRecord = Row<'activity_records'>
export type WorkingSet = ViewRow<'v_working_sets'>
