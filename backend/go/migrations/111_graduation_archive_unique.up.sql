ALTER TABLE graduation_project_archives
    ADD CONSTRAINT graduation_project_archives_topic_user_key UNIQUE (topic_id, user_id);
