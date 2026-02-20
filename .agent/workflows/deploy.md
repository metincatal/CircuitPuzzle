---
description: Her değişiklik sonrası commit, push ve GitHub Pages'e deploy et
---
# Deploy Workflow

Her değişiklik sonrası aşağıdaki adımları takip et:

// turbo-all

1. Değişiklikleri stage et:
```bash
cd /Users/metincatal/Desktop/Games/CircuitPuzzle && git add -A
```

2. Commit oluştur (değişikliğe uygun mesaj ile):
```bash
cd /Users/metincatal/Desktop/Games/CircuitPuzzle && git commit -m "değişiklik mesajı"
```

3. Push et:
```bash
cd /Users/metincatal/Desktop/Games/CircuitPuzzle && git push origin web-deploy
```

4. Web build oluştur:
```bash
cd /Users/metincatal/Desktop/Games/CircuitPuzzle && npx expo export --platform web
```

5. GitHub Pages'e deploy et:
```bash
cd /Users/metincatal/Desktop/Games/CircuitPuzzle && npx gh-pages -d dist
```

**Not:** Bu adımlar HER değişiklik sonrası otomatik olarak yapılmalıdır.
