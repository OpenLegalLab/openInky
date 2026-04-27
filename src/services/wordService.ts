/// <reference types="office-js" />

import { DiffChunk } from './diffService';

export async function getSelectedTextOrDocument(): Promise<{ text: string; range: Word.Range }> {
  return Word.run(async (context) => {
    let range = context.document.getSelection();
    range.load('text');
    await context.sync();

    if (!range.text || range.text.trim() === '') {
      range = context.document.body.getRange();
      range.load('text');
      await context.sync();
    }

    return {
      text: range.text,
      // Note: We return the Word.Range but caller must use it within a Word.run context
      // actually passing Word.Range between Word.runs is tricky or requires tracking
      // Let's adjust this: return text and let caller handle Word.run
      range: range,
    };
  });
}

// Since passing ranges between Word.run contexts can be problematic without tracking,
// it's better to combine reading and writing or keep Word.run tightly scoped.
// Let's modify `getSelectedTextOrDocumentText` to just get text, and a function to apply changes.
export async function getTargetText(): Promise<string> {
  return Word.run(async (context) => {
    let range = context.document.getSelection();
    range.load('text');
    await context.sync();

    if (!range.text || range.text.trim() === '') {
      range = context.document.body.getRange();
      range.load('text');
      await context.sync();
    }

    return range.text;
  });
}

export async function applyTrackedChanges(diffs: DiffChunk[]) {
  await Word.run(async (context) => {
    const doc = context.document;
    
    // Enable Track Changes
    doc.changeTrackingMode = Word.ChangeTrackingMode.trackAll;

    // Get the target range to replace
    let range = doc.getSelection();
    range.load('text');
    await context.sync();

    if (!range.text || range.text.trim() === '') {
      range = doc.body.getRange();
    }

    // Clear the original range text, but since we are tracking changes, this will show as a big deletion.
    // Wait, the requirement says "applying insertions and deletions sequentially to the document range."
    // If we just clear and insert, it shows a big deletion and a big insertion.
    // To do it cleanly, we can iterate and insert/delete precisely. But `range.insertText` can be easier if we start from the beginning of the range.
    // Let's clear the range (which deletes it) and then insert chunks?
    // Wait, deleting the whole thing might be too coarse. If we just clear, it's one big deletion.
    // If we want minimal diffing, we should walk through the existing text and replace it, but Word APIs don't make it easy to traverse word-by-word via diff.
    // Actually, `jsdiff` tells us what was removed and added.
    // A simpler approach: we clear the entire original range. Then we insert the diff chunks one by one.
    // Insertions are marked as additions. Removed are just left out? No, if we want them to show as deleted, we MUST delete them in Word.
    // Actually, if we just delete the whole range, it will show as one big deletion, and the new text as one big insertion.
    // That defeats the purpose of jsdiff.
    // To get clean redlining: We can search for the original range, then insert/delete relative to it.
    // Wait, let's keep it simple: we reconstruct the text by inserting the original text that was NOT changed, and deleting what was removed.
    // Actually, an easier way is to just replace the whole text. Wait, if we enable track changes, and then do `range.insertText` sequentially?
    // No, if we delete the old text without tracking, and then insert new text with tracking, it just shows as insertion.
    // Let's do this: 
    // 1. Delete the entire range WITHOUT track changes (or keep it?). The plan says: "insertions and deletions sequentially to the document range".
    // If we have an array of chunks, we can clear the range, and then insert the new text, but how do we represent deletions?
    // We can insert the deleted text and immediately delete it with Track Changes enabled!
    // Yes! 
    // - Turn OFF track changes.
    // - Clear the range.
    // - Turn ON track changes.
    // - For each chunk:
    //    If added: insert text (shows as added)
    //    If removed: insert text, then delete it (shows as deleted)
    //    If unchanged: insert text (wait, if we turn ON track changes, unchanged text will show as added! We need to insert unchanged text with track changes OFF).
    
    // Better strategy:
    // Turn OFF track changes.
    // Clear range.
    // For each chunk:
    //   If added: Turn ON track changes. Insert text.
    //   If removed: Turn OFF track changes. Insert text. Turn ON track changes. Delete the text we just inserted.
    //   If unchanged: Turn OFF track changes. Insert text.
    
    // Let's refine this:
    doc.changeTrackingMode = Word.ChangeTrackingMode.trackMineOnly; // or trackAll, wait, trackAll might track our inserts.
    
    // Actually, `doc.changeTrackingMode = Word.ChangeTrackingMode.off;`
    // Wait, Word JS API changeTrackingMode is a document property.
    doc.changeTrackingMode = Word.ChangeTrackingMode.off;
    range.clear();
    await context.sync();

    // We need to keep a cursor to insert text.
    let currentRange = range.insertText('', Word.InsertLocation.start);

    for (const chunk of diffs) {
      if (chunk.added) {
        doc.changeTrackingMode = Word.ChangeTrackingMode.trackAll;
        currentRange = currentRange.insertText(chunk.value, Word.InsertLocation.after);
        await context.sync();
      } else if (chunk.removed) {
        doc.changeTrackingMode = Word.ChangeTrackingMode.off;
        let tempRange = currentRange.insertText(chunk.value, Word.InsertLocation.after);
        await context.sync();
        
        doc.changeTrackingMode = Word.ChangeTrackingMode.trackAll;
        tempRange.delete(); // This will mark it as deleted!
        await context.sync();
        currentRange = tempRange; // currentRange moves past the deleted text
      } else {
        doc.changeTrackingMode = Word.ChangeTrackingMode.off;
        currentRange = currentRange.insertText(chunk.value, Word.InsertLocation.after);
        await context.sync();
      }
    }
    
    doc.changeTrackingMode = Word.ChangeTrackingMode.off;
    await context.sync();
  });
}
