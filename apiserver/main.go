// Command apiserver is the HTTP backend for the inference performance platform.
//
// It is a standalone binary that imports the BLIS simulation engine (sim/) and
// the curated library package directly. It deliberately makes no changes to the
// blis CLI (cmd/) or the DES core, so upstream inference-sim features can be
// merged independently. See docs/UPSTREAM-DELTAS.md.
package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/DanielKernel/inference-sim-platform/library"
)

func main() {
	addr := flag.String("addr", ":8080", "HTTP listen address")
	dataDir := flag.String("data", "data", "path to curated data/ directory")
	flag.Parse()

	store, err := library.Load(*dataDir)
	if err != nil {
		log.Fatalf("apiserver: loading library data from %q: %v", *dataDir, err)
	}
	log.Printf("apiserver: loaded %d models, %d hardware, %d frameworks, %d scenarios, %d perf records, %d optimizations",
		len(store.Models), len(store.Hardware), len(store.Frameworks),
		len(store.Scenarios), len(store.PerfRecords), len(store.Optimizations))

	srv := NewServer(store, *dataDir)

	httpSrv := &http.Server{
		Addr:              *addr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}
	log.Printf("apiserver: listening on %s", *addr)
	if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Printf("apiserver: server error: %v", err)
		os.Exit(1)
	}
}
