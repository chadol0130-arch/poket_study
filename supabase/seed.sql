-- =============================================================================
-- 로컬 개발용 시드 (supabase db reset 시 자동 실행)
--   * 테스트 계정 (admin/teacher/student) 생성 — 로그인 비밀번호: password123
--   * 포켓몬 카탈로그 (3개 스타터 라인 + 피카츄 라인)
--   * 스타터 후보 / 상점 / 반 / 등록 / 샘플 과제
-- ⚠️ 운영(cloud)에서는 실행하지 말 것. 계정은 관리자 UI 로 생성하세요.
-- =============================================================================

-- 로그인 가능한 테스트 유저 생성 헬퍼(임시). handle_new_user 트리거가 profiles 를 만든다.
create or replace function pg_temp.create_dev_user(
  p_email text, p_pass text, p_role text, p_name text
) returns uuid language plpgsql as $$
declare
  uid uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    p_email, crypt(p_pass, gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_name, 'display_name', p_name, 'role', p_role),
    false, false
  );
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), uid,
    jsonb_build_object('sub', uid::text, 'email', p_email),
    'email', uid::text, now(), now(), now()
  );
  return uid;
end $$;

do $$
declare
  v_admin   uuid;
  v_teacher uuid;
  v_s1 uuid; v_s2 uuid; v_s3 uuid;
  v_class   uuid;
  -- 진화 체인
  c_bulba uuid; c_char uuid; c_squir uuid; c_pika uuid;
  -- 종
  sp1 uuid; sp2 uuid; sp3 uuid;     -- bulbasaur line
  sp4 uuid; sp5 uuid; sp6 uuid;     -- charmander line
  sp7 uuid; sp8 uuid; sp9 uuid;     -- squirtle line
  sp25 uuid; sp26 uuid;             -- pikachu line
  v_assignment uuid;
begin
  -- ---- 계정 ----
  v_admin   := pg_temp.create_dev_user('admin@test.com',   'password123', 'admin',   '관리자');
  v_teacher := pg_temp.create_dev_user('teacher@test.com', 'password123', 'teacher', '김선생');
  v_s1 := pg_temp.create_dev_user('s1@test.com', 'password123', 'student', '학생일');
  v_s2 := pg_temp.create_dev_user('s2@test.com', 'password123', 'student', '학생이');
  v_s3 := pg_temp.create_dev_user('s3@test.com', 'password123', 'student', '학생삼');

  -- ---- 진화 체인 ----
  insert into public.evolution_chains (name) values ('bulbasaur')  returning id into c_bulba;
  insert into public.evolution_chains (name) values ('charmander') returning id into c_char;
  insert into public.evolution_chains (name) values ('squirtle')   returning id into c_squir;
  insert into public.evolution_chains (name) values ('pikachu')    returning id into c_pika;

  -- ---- 종 (스프라이트는 비어 있음 — 관리자 UI 에서 업로드) ----
  insert into public.pokemon_species (pokedex_number, name, name_ko, type1) values
    (1, 'Bulbasaur', '이상해씨', 'grass') returning id into sp1;
  insert into public.pokemon_species (pokedex_number, name, name_ko, type1) values
    (2, 'Ivysaur', '이상해풀', 'grass') returning id into sp2;
  insert into public.pokemon_species (pokedex_number, name, name_ko, type1) values
    (3, 'Venusaur', '이상해꽃', 'grass') returning id into sp3;
  insert into public.pokemon_species (pokedex_number, name, name_ko, type1) values
    (4, 'Charmander', '파이리', 'fire') returning id into sp4;
  insert into public.pokemon_species (pokedex_number, name, name_ko, type1) values
    (5, 'Charmeleon', '리자드', 'fire') returning id into sp5;
  insert into public.pokemon_species (pokedex_number, name, name_ko, type1) values
    (6, 'Charizard', '리자몽', 'fire') returning id into sp6;
  insert into public.pokemon_species (pokedex_number, name, name_ko, type1) values
    (7, 'Squirtle', '꼬부기', 'water') returning id into sp7;
  insert into public.pokemon_species (pokedex_number, name, name_ko, type1) values
    (8, 'Wartortle', '어니부기', 'water') returning id into sp8;
  insert into public.pokemon_species (pokedex_number, name, name_ko, type1) values
    (9, 'Blastoise', '거북왕', 'water') returning id into sp9;
  insert into public.pokemon_species (pokedex_number, name, name_ko, type1) values
    (25, 'Pikachu', '피카츄', 'electric') returning id into sp25;
  insert into public.pokemon_species (pokedex_number, name, name_ko, type1) values
    (26, 'Raichu', '라이츄', 'electric') returning id into sp26;

  -- ---- 진화 단계 (테스트 편의를 위해 낮은 min_level) ----
  insert into public.evolution_stages (chain_id, species_id, stage_order, min_level) values
    (c_bulba, sp1, 1, 1), (c_bulba, sp2, 2, 2), (c_bulba, sp3, 3, 4),
    (c_char,  sp4, 1, 1), (c_char,  sp5, 2, 2), (c_char,  sp6, 3, 4),
    (c_squir, sp7, 1, 1), (c_squir, sp8, 2, 2), (c_squir, sp9, 3, 4),
    (c_pika,  sp25, 1, 1), (c_pika, sp26, 2, 2);

  -- ---- 스타터 후보 ----
  insert into public.starter_options (species_id, chain_id, display_order, is_active) values
    (sp1, c_bulba, 1, true),
    (sp4, c_char,  2, true),
    (sp7, c_squir, 3, true);

  -- ---- 상점 (코인으로 구입 가능한 포켓몬) ----
  insert into public.shop_listings (species_id, chain_id, price, is_active, display_order) values
    (sp25, c_pika,  30, true, 1),   -- 피카츄
    (sp4,  c_char,  50, true, 2),   -- 파이리
    (sp7,  c_squir, 50, true, 3);   -- 꼬부기

  -- ---- 반 / 배정 / 등록 ----
  insert into public.classes (name, created_by) values ('테스트반', v_admin) returning id into v_class;
  insert into public.class_teachers (class_id, teacher_id) values (v_class, v_teacher);
  insert into public.enrollments (class_id, student_id, status) values
    (v_class, v_s1, 'active'),
    (v_class, v_s2, 'active'),
    (v_class, v_s3, 'active');

  -- ---- 샘플 과제 (120 XP → 레벨2 → 2단계 진화 확인용) ----
  insert into public.homework_assignments (class_id, title, description, xp_reward, coin_reward, created_by)
  values (v_class, '1단원 문제집 1~10쪽', '풀고 사진 찍어 올리기', 120, 40, v_teacher)
  returning id into v_assignment;
end $$;
