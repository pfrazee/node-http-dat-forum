--------------------------------------------------------------------------------
-- Up
--------------------------------------------------------------------------------

CREATE TABLE User (
  url             TEXT    PRIMARY KEY,

  name            TEXT    NOT NULL,
  isAdmin         NUMERIC,

  createdAt       INTEGER

  CONSTRAINT User_ck_isAdmin CHECK (isAdmin IN (0, 1))
);
CREATE INDEX User_ix_name ON User (name);

CREATE TABLE Post (
  id              INTEGER PRIMARY KEY,
  url             TEXT    UNIQUE,
  authorUrl       TEXT    NOT NULL,
  threadRootUrl   TEXT,
  threadParentUrl TEXT,

  title           TEXT    NOT NULL,
  body            TEXT    NOT NULL,

  firstIndexedAt  INTEGER,
  lastIndexedAt   INTEGER,

  FOREIGN KEY (threadRootUrl) REFERENCES Post (url),
  FOREIGN KEY (threadParentUrl) REFERENCES Post (url)
);
CREATE INDEX Post_ix_url ON Post (url);
CREATE INDEX Post_ix_threadRootUrl ON Post (threadRootUrl);
CREATE INDEX Post_ix_firstIndexedAt ON Post (firstIndexedAt);


--------------------------------------------------------------------------------
-- Down
--------------------------------------------------------------------------------

DROP INDEX Post_ix_firstIndexedAt;
DROP TABLE Post;
DROP INDEX User_ix_name;
DROP TABLE User;