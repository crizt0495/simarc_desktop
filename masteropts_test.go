package main

import (
	"testing"

	"arsippro/internal/config"
	"arsippro/internal/database"
)

func TestMasterOpts(t *testing.T) {
	config.Load()
	if err := database.Connect(); err != nil {
		t.Fatal(err)
	}
	if err := database.Migrate(); err != nil {
		t.Fatal(err)
	}
	a := NewApp()
	a.startup(nil) // may be nil ctx; but DB already connected
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("PANIC: %v", r)
		}
	}()
	out := a.GetMasterOptions()
	t.Logf("keys: %v", func() []string {
		var ks []string
		for k := range out {
			ks = append(ks, k)
		}
		return ks
	}())
	for k, v := range out {
		t.Logf("  %s: %d", k, len(v))
	}
}
