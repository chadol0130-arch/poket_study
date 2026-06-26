// 손으로 관리하는 도메인 타입. (Supabase 타입 생성을 쓰려면
// `supabase gen types typescript` 결과로 교체 가능)

export type Role = "admin" | "teacher" | "student";

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  display_name: string;
  coin_balance: number;
  created_at: string;
}

export interface PokemonSpecies {
  id: string;
  pokedex_number: number;
  name: string;
  name_ko: string;
  type1: string | null;
  type2: string | null;
  base_stats: Record<string, number>;
}

export interface EvolutionChain {
  id: string;
  name: string;
}

export interface EvolutionStage {
  id: string;
  chain_id: string;
  species_id: string;
  stage_order: number;
  min_level: number;
}

export interface Sprite {
  id: string;
  species_id: string;
  variant: "default" | "shiny" | "back" | "front";
  storage_path: string;
}

export interface StarterOption {
  id: string;
  species_id: string;
  chain_id: string;
  display_order: number;
  is_active: boolean;
}

export interface ShopListing {
  id: string;
  species_id: string;
  chain_id: string;
  price: number;
  is_active: boolean;
  display_order: number;
  min_level_to_buy: number;
}

export interface StudentPokemon {
  id: string;
  student_id: string;
  chain_id: string;
  current_species_id: string;
  nickname: string | null;
  level: number;
  xp: number;
  is_active: boolean;
  acquired_via: "starter" | "purchase" | "gift";
  created_at: string;
  updated_at: string;
}

export interface Classroom {
  id: string;
  name: string;
  academy_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Enrollment {
  id: string;
  class_id: string;
  student_id: string;
  status: "active" | "inactive";
  enrolled_at: string;
}

export interface HomeworkAssignment {
  id: string;
  class_id: string;
  title: string;
  description: string;
  due_at: string | null;
  xp_reward: number;
  coin_reward: number;
  created_by: string | null;
  created_at: string;
}

export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  status: SubmissionStatus;
  photo_paths: string[];
  note: string;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  xp_awarded: number;
  coin_awarded: number;
}
