package platform

import "testing"

func TestSplitSQLStatements(t *testing.T) {
	sql := `-- migration header
CREATE TABLE IF NOT EXISTS a (
  id BIGINT PRIMARY KEY,
  txt VARCHAR(255)
);

# comment style 2
CREATE TABLE IF NOT EXISTS b (
  id BIGINT PRIMARY KEY,
  val VARCHAR(255) DEFAULT 'x;y'
);

/* block comment; ignored */
CREATE TABLE IF NOT EXISTS c (
  id BIGINT PRIMARY KEY
);`

	parts := splitSQLStatements(sql)
	if len(parts) != 3 {
		t.Fatalf("expected 3 statements, got %d", len(parts))
	}
}
