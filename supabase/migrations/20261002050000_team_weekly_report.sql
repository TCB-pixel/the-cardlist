-- Performance รายสัปดาห์: ทุกวันจันทร์ 9:00 น. เวลาไทย (02:00 UTC) สรุปสัปดาห์ก่อน → Google Sheets แท็บ "รายสัปดาห์" + LINE ถึงเจ้าของ
select cron.schedule(
  'team-weekly-report',
  '0 2 * * 1',
  $$
  select net.http_post(
    url := 'https://mkexidyjjnasyyeqcsvf.supabase.co/functions/v1/team-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'chatbot_cron_secret')
    ),
    body := '{"job":"weekly"}'::jsonb
  );
  $$
);
