# API Spec — Lefse Backend B4
_Generado: 2026-04-07 | Estado: 🟢 Completo_

---

## TRANSVERSALES

### Global Error Handler
Todos los endpoints retornan errores en formato unificado:
```json
{
  "code": "INVOICE_NOT_FOUND",
  "message": "La factura solicitada no existe",
  "details": {},
  "requestId": "req_01HX..."
}
```

### DTO Validation
Zod en cada endpoint. Middleware global: si falla Zod → HTTP 422 con campo `details` mostrando errores por campo.

### Rate Limiting (Redis sliding window)
| Plan | API general | AI queries | OCR | Email inbound |
|------|-------------|------------|-----|---------------|
| FREE | 100 req/min | 10/día | 20/mes | 50/mes |
| STARTER | 300 req/min | 50/día | 100/mes | 200/mes |
| PRO | 600 req/min | ilimitado | 500/mes | 1000/mes |
| AGENCY | 1200 req/min | ilimitado | ilimitado | ilimitado |

### Audit Log (inmutable)
Tabla `audit_log` INSERT-only. Registra: `user_id`, `action`, `entity`, `entity_id`, `payload_hash`, `ip`, `user_agent`, `created_at`.

### Logging estructurado
- Request: `method + route + userId + statusCode + ms`
- Error: stack trace + requestId + userId
- Fiscal: cada acción sobre factura o verifactu con hash del payload

---

## MÓDULO AUTH

**Responsabilidad:** Gestión de identidad — registro, login, tokens JWT + refresh, OAuth2 Google, 2FA TOTP opcional.

### Endpoints

| Método | Ruta | Body | Response | Auth | Rate-limit |
|--------|------|------|----------|------|------------|
| POST | /auth/register | `{ email, password, name }` | `{ user, accessToken, refreshToken }` | — | 10/hora/IP |
| POST | /auth/login | `{ email, password }` | `{ accessToken, refreshToken, user }` | — | 20/hora/IP |
| POST | /auth/refresh | `{ refreshToken }` | `{ accessToken, refreshToken }` | — | 60/hora |
| POST | /auth/logout | `{ refreshToken }` | `{ ok: true }` | JWT | — |
| GET | /auth/verify-email | `?token=xxx` | redirect `/dashboard` | — | 10/hora/IP |
| POST | /auth/forgot-password | `{ email }` | `{ ok: true }` | — | 5/hora/IP |
| POST | /auth/reset-password | `{ token, newPassword }` | `{ ok: true }` | — | 10/hora/IP |
| GET | /auth/google | — | redirect OAuth2 | — | — |
| GET | /auth/google/callback | `?code=xxx` | `{ accessToken, refreshToken, user }` | — | — |
| POST | /auth/2fa/enable | `{ password }` | `{ secret, qrCode }` | JWT | 5/hora |
| POST | /auth/2fa/verify | `{ code }` | `{ ok: true, backupCodes }` | JWT | 10/hora |
| POST | /auth/2fa/disable | `{ code }` | `{ ok: true }` | JWT | 5/hora |

### Lógica crítica — register
```
1. Zod: email válido, password ≥10 chars, name no vacío
2. Hash password → bcrypt rounds=12
3. INSERT users (id=ulid, email, password_hash, name, plan=FREE)
4. Generar token verificación email (crypto.randomBytes(32), TTL 24h) → Redis
5. Enviar email verificación via Mailgun EU
6. Generar accessToken JWT (RS256, exp 15min) + refreshToken (RS256, exp 7d)
7. INSERT refresh_tokens (token_hash, user_id, expires_at, ip, user_agent)
8. INSERT audit_log (action=USER_REGISTERED, entity=user, entity_id)
9. Retornar { user, accessToken, refreshToken }
```

### Lógica crítica — login
```
1. Zod: email + password
2. SELECT user WHERE email; si no existe → 401 (mensaje genérico)
3. bcrypt.compare; si falla → 401 + incrementar fail_count en Redis
4. Si fail_count ≥5 → lock 15min → 429
5. Si 2FA activo: retornar { requiresTwoFactor: true, tempToken } (TTL 5min)
6. Si 2FA: POST /auth/2fa/verify con tempToken + TOTP code → validar speakeasy
7. Generar accessToken + refreshToken (rotar si viene de refresh existente)
8. Limpiar fail_count Redis
9. INSERT audit_log (action=USER_LOGIN)
```

### Lógica crítica — refresh
```
1. Validar refreshToken JWT (signature + exp)
2. SELECT refresh_tokens WHERE token_hash = sha256(refreshToken) AND revoked=false
3. Si no existe o expirado → 401
4. Generar nuevos accessToken + refreshToken
5. Marcar token anterior revoked=true (rotación completa)
6. INSERT nuevo refresh_token
```

### Guards
- `JwtAuthGuard`: verifica Bearer token, inyecta `req.user`
- `RolesGuard`: `@Roles('admin')` decorator — verifica `user.role`
- `PlanGuard`: hook Fastify pre-handler — verifica límites plan antes de acción (ver módulo Billing)

### Errores manejados
| Code | HTTP | Descripción |
|------|------|-------------|
| AUTH_INVALID_CREDENTIALS | 401 | Email/password incorrectos |
| AUTH_EMAIL_NOT_VERIFIED | 403 | Email pendiente verificación |
| AUTH_TOKEN_EXPIRED | 401 | JWT expirado |
| AUTH_TOKEN_INVALID | 401 | JWT malformado o firma inválida |
| AUTH_REFRESH_REVOKED | 401 | Refresh token ya usado o revocado |
| AUTH_2FA_REQUIRED | 403 | 2FA activado, falta código |
| AUTH_2FA_INVALID | 401 | Código TOTP incorrecto |
| AUTH_RATE_LIMITED | 429 | Demasiados intentos |
| AUTH_ACCOUNT_LOCKED | 423 | Cuenta bloqueada temporalmente |

---

## MÓDULO USERS

**Responsabilidad:** Perfil fiscal del usuario — NIF/CIF, régimen IVA, CRUD, export RGPD y anonimización.

### Endpoints

| Método | Ruta | Body | Response | Auth | Rate-limit |
|--------|------|------|----------|------|------------|
| GET | /users/me | — | `User` completo | JWT | — |
| PATCH | /users/me | `Partial<UserProfile>` | `User` actualizado | JWT | 30/hora |
| GET | /users/me/fiscal | — | datos fiscales | JWT | — |
| PUT | /users/me/fiscal | `FiscalProfile` | fiscal actualizado | JWT | 20/hora |
| GET | /users/me/export | — | ZIP (RGPD art.20) | JWT | 2/día |
| DELETE | /users/me | `{ password, confirm: "DELETE" }` | `{ ok: true }` | JWT | 1/día |
| GET | /users/me/inbox-address | — | `{ address: "hash@inbox.lefse.io" }` | JWT | — |

### FiscalProfile schema (Zod)
```typescript
{
  nif: string,          // validado algoritmo oficial
  nombre_fiscal: string,
  regimen_iva: enum('GENERAL', 'SIMPLIFICADO', 'RECARGO_EQUIVALENCIA', 'EXENTO'),
  epigrafe_iae: string, // 4 dígitos
  domicilio_fiscal: {
    calle: string,
    numero: string,
    piso?: string,
    cp: string,        // 5 dígitos España
    municipio: string,
    provincia: string,
    pais: string       // default 'ES'
  },
  tipo_retencion_irpf: enum('15', '7', '2', '0'),
  actividad_profesional: string
}
```

### Validación NIF/CIF (algoritmo oficial)
```
NIE (X/Y/Z + 7 dígitos + letra):
1. X→0, Y→1, Z→2
2. Número resultante % 23 → índice en 'TRWAGMYFPDXBNJZSQVHLCKE'
3. Comparar con letra final

NIF persona física (8 dígitos + letra):
1. número % 23 → índice en 'TRWAGMYFPDXBNJZSQVHLCKE'
2. Comparar con letra final

CIF empresa (letra + 7 dígitos + letra/número):
1. Separar dígitos pares e impares
2. Impares: suma directa
3. Pares: cada uno ×2, si >9 sumar dígitos → acumular
4. Suma total % 10; si 0 → control=0 sino control = 10 - (suma%10)
5. Si letra inicial en ABCDEFGHJNPQRSUVW → control puede ser letra O número
6. Tabla letras control: JABCDEFGHI
```

### Lógica crítica — DELETE (anonimización RGPD)
```
1. Verificar password + confirm="DELETE"
2. INSERT audit_log (action=USER_DELETION_REQUESTED)
3. UPDATE users SET
     email = 'anon_' || id || '@deleted.lefse.io',
     name = 'Usuario eliminado',
     password_hash = NULL,
     nif = hash(nif || salt_rgpd),  -- pseudoanonimización fiscal
     domicilio_fiscal = NULL,
     deleted_at = NOW()
4. Revocar todos refresh_tokens
5. DELETE sesiones activas Redis
6. Facturas: mantener (obligación fiscal 4 años) con user_id pseudoanonimizado
7. Historial AI: DELETE (no obligación fiscal)
8. INSERT audit_log (action=USER_ANONYMIZED)
9. Enviar email confirmación eliminación
```

### Lógica crítica — export RGPD
```
1. Recopilar: perfil, facturas, gastos, historial AI, notificaciones, audit_log propio
2. Serializar JSON estructurado
3. Generar ZIP cifrado (password = token firmado 1h)
4. Upload R2 con TTL 24h
5. Enviar email con link descarga
6. Retornar { downloadUrl, expiresAt }
```

### Errores manejados
| Code | HTTP | Descripción |
|------|------|-------------|
| USER_NIF_INVALID | 422 | NIF/CIF no válido según algoritmo oficial |
| USER_NIF_DUPLICATE | 409 | NIF ya registrado |
| USER_EXPORT_RATE_LIMIT | 429 | Máx 2 exports/día |
| USER_NOT_FOUND | 404 | Usuario no existe |

---

## MÓDULO INVOICES

**Responsabilidad:** CRUD facturas emitidas — estados, numeración, cálculo fiscal, PDF y ciclo de vida completo.

### Endpoints

| Método | Ruta | Body | Response | Auth | Rate-limit |
|--------|------|------|----------|------|------------|
| GET | /invoices | `?page&limit&status&from&to&serie` | `{ items[], total, page }` | JWT | — |
| POST | /invoices | `InvoiceCreate` | `Invoice` DRAFT | JWT | PlanGuard |
| GET | /invoices/:id | — | `Invoice` completo | JWT | — |
| PATCH | /invoices/:id | `Partial<InvoiceCreate>` | `Invoice` actualizado | JWT | — |
| DELETE | /invoices/:id | — | `{ ok: true }` | JWT | — |
| POST | /invoices/:id/seal | — | `Invoice` PENDING_SEAL→SEALED | JWT | PlanGuard |
| POST | /invoices/:id/send-email | `{ to, cc?, message? }` | `{ ok: true, messageId }` | JWT | 10/hora |
| POST | /invoices/:id/mark-paid | `{ paidAt?, method? }` | `Invoice` PAID | JWT | — |
| POST | /invoices/:id/void | `{ reason }` | `Invoice` VOID + rectificativa | JWT | — |
| POST | /invoices/:id/duplicate | — | `Invoice` DRAFT (nueva) | JWT | PlanGuard |
| GET | /invoices/:id/pdf | — | PDF binary | JWT | 60/hora |
| GET | /invoices/series | — | `Serie[]` del usuario | JWT | — |
| POST | /invoices/series | `{ prefix, resetYearly }` | `Serie` | JWT | — |

### InvoiceCreate schema (Zod)
```typescript
{
  serie: string,             // ej: 'A', 'B', 'REC'
  cliente: {
    nombre: string,
    nif: string,             // validado
    email?: string,
    domicilio?: string
  },
  fecha_emision: date,
  fecha_vencimiento?: date,
  concepto: string,
  lineas: [{
    descripcion: string,
    cantidad: number,          // >0
    precio_unitario: number,   // ≥0
    tipo_iva: enum('21','10','4','0'),
    tipo_irpf?: enum('15','7','2','0')
  }],
  notas?: string,
  moneda: string              // default 'EUR'
}
```

### Numeración automática
```
1. SELECT serie WHERE user_id = ? AND prefix = ?
2. Si resetYearly: secuencial reinicia cada año civil
3. numero = prefix + '/' + año + '/' + lpad(siguiente_secuencial, 4, '0')
   ej: A/2026/0001
4. UPDATE series SET last_sequence = last_sequence + 1 (FOR UPDATE — evita duplicados)
5. UNIQUE constraint (user_id, numero_factura)
```

### Cálculo fiscal
```
Para cada línea:
  base_linea = cantidad × precio_unitario
  iva_linea = base_linea × (tipo_iva / 100)
  irpf_linea = base_linea × (tipo_irpf / 100)
  total_linea = base_linea + iva_linea - irpf_linea

Totales factura:
  base_imponible = SUM(base_linea)  [redondeo 2 decimales ROUND_HALF_UP]
  total_iva = SUM(iva_linea)        [redondeo 2 decimales]
  total_irpf = SUM(irpf_linea)      [redondeo 2 decimales]
  total_factura = base_imponible + total_iva - total_irpf

Regla desglose IVA: agrupar por tipo_iva para cuadro resumen
```

### Estados y transiciones
```
DRAFT → PENDING_SEAL (al llamar /seal)
PENDING_SEAL → SEALED (tras sello Verifactu exitoso)
SEALED → SENT (tras /send-email)
SENT → PAID (tras /mark-paid)
SEALED|SENT|PAID → VOID (tras /void, genera rectificativa)
DRAFT → DELETE permitido
SEALED|SENT|PAID → DELETE bloqueado (obligación fiscal)
```

### Lógica crítica — /seal
```
1. Verificar estado = DRAFT
2. Verificar perfil fiscal completo (NIF, régimen IVA)
3. Calcular totales definitivos (inmutables desde este punto)
4. UPDATE invoice SET estado=PENDING_SEAL, totales=calculados, locked_at=NOW()
5. Encolar job verifactu.submit { invoiceId }
6. Retornar invoice con estado PENDING_SEAL
(El estado pasa a SEALED de forma asíncrona cuando Verifactu confirma)
```

### Lógica crítica — /void
```
1. Verificar estado IN (SEALED, SENT, PAID)
2. Crear factura rectificativa tipo R (referencia a original)
3. Líneas negadas (cantidades negativas)
4. Sellar rectificativa también vía Verifactu (obligatorio RD 1007/2023)
5. UPDATE original SET estado=VOID, rectificativa_id=nueva_id
6. INSERT audit_log (action=INVOICE_VOIDED)
```

### PDF generation (pdf-lib)
```
1. Template base con logo, colores marca #FF4D00
2. Cabecera: emisor (datos fiscales usuario), cliente, número, fechas
3. Tabla líneas: descripción, cantidad, precio, IVA%, importe
4. Cuadro resumen: base imponible, IVA desglosado, IRPF, TOTAL
5. Footer: texto legal Verifactu + QR con hash registro
6. Si sellada: incluir QR con hash Verifactu + timestamp sello
7. Upload R2 con key = invoices/{userId}/{invoiceId}.pdf
8. Retornar stream o URL firmada 1h
```

### Errores manejados
| Code | HTTP | Descripción |
|------|------|-------------|
| INVOICE_NOT_FOUND | 404 | Factura no existe o no pertenece al usuario |
| INVOICE_INVALID_STATE | 409 | Transición de estado no permitida |
| INVOICE_NUMERO_DUPLICATE | 409 | Número de factura ya existe en la serie |
| INVOICE_FISCAL_INCOMPLETE | 422 | Perfil fiscal incompleto para sellar |
| INVOICE_CLIENT_NIF_INVALID | 422 | NIF del cliente no válido |
| INVOICE_DELETE_FORBIDDEN | 403 | No se puede eliminar factura sellada |
| PLAN_LIMIT | 429 | Límite de facturas del plan alcanzado |

### Jobs emitidos
- `verifactu.submit` al ejecutar /seal
- `email.send` al ejecutar /send-email (via Mailgun EU)

---

## MÓDULO VERIFACTU

**Responsabilidad:** Generación XML RD 1007/2023, hash SHA-256 encadenado, firma eIDAS Uanataca, envío AEAT, registro inmutable.

### Endpoints

| Método | Ruta | Body | Response | Auth | Rate-limit |
|--------|------|------|----------|------|------------|
| POST | /verifactu/submit | `{ invoiceId }` | `{ jobId }` | JWT+interno | 100/hora |
| GET | /verifactu/status/:id | — | `VerifactuRecord` | JWT | — |
| GET | /verifactu/audit-trail/:invoiceId | — | `VerifactuRecord[]` | JWT | — |

### Estructura XML (RD 1007/2023)
```xml
<SuministroLRFacturasEmitidas>
  <Cabecera>
    <IDVersion>1.0</IDVersion>
    <ObligadoEmision>
      <NombreRazon>{nombre_fiscal}</NombreRazon>
      <NIF>{nif}</NIF>
    </ObligadoEmision>
  </Cabecera>
  <RegistroFactura>
    <RegistroAlta>
      <IDFactura>
        <IDEmisorFactura>{nif}</IDEmisorFactura>
        <NumSerieFactura>{numero}</NumSerieFactura>
        <FechaExpedicionFactura>{dd-mm-yyyy}</FechaExpedicionFactura>
      </IDFactura>
      <TipoFactura>F1</TipoFactura>  <!-- F1 normal, R rectificativa -->
      <DescripcionOperacion>{concepto}</DescripcionOperacion>
      <Desglose>...</Desglose>
      <CuotaTotal>{total_iva}</CuotaTotal>
      <ImporteTotal>{total_factura}</ImporteTotal>
      <Encadenamiento>
        <PrimerRegistro>N</PrimerRegistro>  <!-- S si es la primera -->
        <RegistroAnterior>
          <IDEmisorFactura>{nif}</IDEmisorFactura>
          <NumSerieFactura>{prev_numero}</NumSerieFactura>
          <FechaExpedicionFactura>{prev_fecha}</FechaExpedicionFactura>
          <Huella>{prev_hash}</Huella>
        </RegistroAnterior>
      </Encadenamiento>
      <SistemaInformatico>
        <NombreRazon>Lefse SL</NombreRazon>
        <NIF>B-XXXXXXXX</NIF>
        <NombreSistemaInformatico>Lefse</NombreSistemaInformatico>
        <IdSistemaInformatico>LEFSE-1.0</IdSistemaInformatico>
        <Version>1.0</Version>
        <NumeroInstalacion>EU-RAILWAY-01</NumeroInstalacion>
      </SistemaInformatico>
      <FechaHoraHusoGenRegistro>{ISO8601}</FechaHoraHusoGenRegistro>
      <TipoHuella>01</TipoHuella>  <!-- SHA-256 -->
      <Huella>{sha256_actual}</Huella>
    </RegistroAlta>
  </RegistroFactura>
</SuministroLRFacturasEmitidas>
```

### Lógica crítica — flujo completo
```
1. Worker recibe job { invoiceId }
2. SELECT invoice con JOIN user fiscal profile
3. Verificar estado = PENDING_SEAL
4. SELECT último registro Verifactu del usuario (ORDER BY created_at DESC)
   → obtener prev_hash (NULL si primer registro)
5. Generar XML con campos calculados
6. Calcular Huella SHA-256:
   campos_concatenados = IDEmisorFactura + NumSerieFactura +
                         FechaExpedicionFactura + TipoFactura +
                         CuotaTotal + ImporteTotal + Huella_anterior
   huella_actual = SHA256(campos_concatenados).hex().toUpperCase()
7. Insertar XML + huella en registro provisional
8. Llamar Uanataca API para firma eIDAS cualificada del XML:
   POST https://api.uanataca.com/api/v1/sign
   Headers: Authorization: Bearer {UANATACA_API_KEY}
   Body: { format: 'XAdES-BES', document: base64(xml), certificate_id }
   Response: { signedXml, signatureValue, timestamp }
9. UPDATE registro con xml_firmado + signature
10. POST AEAT endpoint (sandbox/prod según ENV):
    POST https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SuministroLRFacturasEmitidas
    Headers: SOAPAction, Content-Type: text/xml
    Body: SOAP envelope con XML firmado
11. Parsear respuesta AEAT:
    - CSV (Código Seguro Verificación) de AEAT
    - Estado: AceptadaConErrores | Aceptada | Rechazada
12. INSERT verifactu_records (append-only):
    { invoice_id, user_id, xml_generado, xml_firmado, huella, prev_huella,
      csv_aeat, estado_aeat, respuesta_aeat_raw, enviado_at, created_at }
13. UPDATE invoices SET estado=SEALED, verifactu_csv=csv, sealed_at=NOW()
14. INSERT audit_log (action=INVOICE_SEALED, payload_hash=sha256(xml))
15. Emitir notificación in-app "Factura sellada correctamente"
```

### Reintentos BullMQ
```javascript
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000  // 5s, 25s, 125s
  },
  removeOnComplete: { age: 86400 * 7 },
  removeOnFail: false  // mantener para auditoría
}
```

### Trigger PostgreSQL — tabla append-only
```sql
CREATE OR REPLACE FUNCTION verifactu_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    RAISE EXCEPTION 'verifactu_records es append-only: UPDATE no permitido. Record ID: %', OLD.id;
  END IF;
  IF (TG_OP = 'DELETE') THEN
    RAISE EXCEPTION 'verifactu_records es append-only: DELETE no permitido. Record ID: %', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER verifactu_immutable_trigger
BEFORE UPDATE OR DELETE ON verifactu_records
FOR EACH ROW EXECUTE FUNCTION verifactu_immutable();
```

### Errores manejados
| Code | HTTP / Job | Descripción |
|------|------------|-------------|
| VERIFACTU_AEAT_REJECTED | Job fail | AEAT rechazó el registro |
| VERIFACTU_SIGN_FAILED | Job retry | Uanataca no disponible |
| VERIFACTU_CHAIN_BROKEN | 500 | Hash encadenado inconsistente |
| VERIFACTU_INVOICE_NOT_FOUND | 404 | Factura no encontrada |
| VERIFACTU_INVALID_STATE | 409 | Factura no está en PENDING_SEAL |

### Jobs consumidos
- `verifactu.submit` — worker principal

### Eventos emitidos
- Notificación in-app al sellar (exitoso o fallido)
- Log fiscal en audit_log

---

## MÓDULO OCR

**Responsabilidad:** Pipeline async de extracción de datos fiscales desde imagen/PDF usando Mindee, con eliminación automática de imagen a las 24h.

### Endpoints

| Método | Ruta | Body | Response | Auth | Rate-limit |
|--------|------|------|----------|------|------------|
| POST | /ocr/upload | multipart: `file` (jpg/png/pdf, max 10MB) | `{ jobId, estimatedSeconds }` | JWT | PlanGuard |
| GET | /ocr/result/:jobId | — | `OcrResult` | JWT | 60/hora |

### OcrResult schema
```typescript
{
  jobId: string,
  status: 'QUEUED' | 'PROCESSING' | 'DONE' | 'ERROR',
  draft?: {
    emisor_nombre: string,       confidence: number,
    emisor_nif: string,          confidence: number,
    fecha_emision: date,         confidence: number,
    numero_factura: string,      confidence: number,
    concepto: string,            confidence: number,
    base_imponible: number,      confidence: number,
    tipo_iva: string,            confidence: number,
    cuota_iva: number,           confidence: number,
    total_factura: number,       confidence: number,
    needs_review: boolean,       // true si algún campo <0.7
    low_confidence_fields: string[]
  },
  error?: string
}
```

### Lógica crítica — upload
```
1. Zod: file presente, mimetype IN (image/jpeg, image/png, application/pdf), size ≤10MB
2. PlanGuard: verificar OCR quota del plan
3. Generar key = ocr/{userId}/{ulid}.{ext}
4. Upload a R2 con metadata: { userId, uploadedAt: ISO8601, deleteAfter: +24h }
5. INSERT ocr_jobs { id=ulid, user_id, r2_key, status=QUEUED, created_at }
6. Encolar job ocr.process { jobId, userId, r2Key }
7. INCREMENT usage_tracking(ocr_count) para el mes actual
8. Retornar { jobId, estimatedSeconds: 15 }
```

### Lógica crítica — worker ocr.process
```
1. Obtener r2_key del job
2. Generar URL firmada R2 (TTL 5min) para Mindee
3. POST https://api.mindee.net/v1/products/mindee/invoices/v4/predict
   Headers: Authorization: Token {MINDEE_API_KEY}
   Body: { document: url_firmada }
4. Parsear respuesta Mindee:
   a. Extraer campos con confidence score
   b. Mapear a estructura fiscal española
5. Para cada campo:
   if confidence < 0.7 → añadir a low_confidence_fields
6. UPDATE ocr_jobs SET status=DONE, result=parsed_data, processed_at=NOW()
7. Si ocr_jobs.email_inbound_id → notificar módulo email-inbound
8. Notificar usuario (in-app): "OCR completado, {N} campos requieren revisión"
```

### Lógica crítica — cleanup R2 (cron 02:00)
```
1. SELECT ocr_jobs WHERE created_at < NOW() - INTERVAL '24 hours' AND r2_key IS NOT NULL
2. Para cada job: DELETE objeto en R2
3. UPDATE ocr_jobs SET r2_key=NULL, image_deleted_at=NOW()
4. Log: "OCR cleanup: {N} imágenes eliminadas"
```

### Errores manejados
| Code | HTTP | Descripción |
|------|------|-------------|
| OCR_UNSUPPORTED_FORMAT | 422 | Formato no soportado |
| OCR_FILE_TOO_LARGE | 413 | Archivo supera 10MB |
| OCR_JOB_NOT_FOUND | 404 | jobId no existe o no pertenece al usuario |
| OCR_MINDEE_FAILED | Job fail | Mindee API error |
| PLAN_LIMIT | 429 | Quota OCR del plan agotada |

### Jobs emitidos/consumidos
- Emite: `ocr.process` al hacer upload
- Consume: `ocr.process` en worker (concurrencia 5)
- Cron: `ocr.cleanup` a las 02:00 UTC

---

## MÓDULO EMAIL-INBOUND

**Responsabilidad:** Captura automática de facturas recibidas por email — verificación HMAC Mailgun, parseo adjuntos, pipeline OCR/Factura-e, creación draft gasto.

### Endpoints

| Método | Ruta | Body | Response | Auth | Rate-limit |
|--------|------|------|----------|------|------------|
| POST | /webhooks/email-inbound | multipart Mailgun | `{ ok: true }` | HMAC | — |
| GET | /email-inbound | `?page&limit&status` | `{ items[], total }` | JWT | — |
| GET | /email-inbound/:id | — | `EmailInbound` completo | JWT | — |
| PATCH | /email-inbound/:id/approve | `{ draftOverrides? }` | `Gasto` creado | JWT | — |
| PATCH | /email-inbound/:id/reject | `{ reason }` | `{ ok: true }` | JWT | — |

### Lógica crítica — webhook Mailgun
```
1. Verificar firma HMAC-SHA256:
   expected = HMAC_SHA256(
     key = MAILGUN_WEBHOOK_SIGNING_KEY,
     data = timestamp + token
   )
   if expected !== signature → 401 (silencioso, no revelar motivo)
2. Extraer recipient (ej: abc123def@inbox.lefse.io)
3. Extraer hash = abc123def del subdominio
4. SELECT user WHERE inbox_hash = hash AND deleted_at IS NULL
5. Si no existe → descartar silenciosamente (log warn)
6. PlanGuard: verificar email_inbound quota
7. INSERT email_inbound_jobs {
     user_id, from, subject, body_text, body_html,
     status=PROCESSING, received_at=NOW()
   }
8. Para cada adjunto:
   a. Verificar mimetype: application/xml → Factura-e directo
      application/pdf o image/* → OCR pipeline
      otros → ignorar (log)
   b. Verificar tamaño ≤10MB
   c. Upload a R2: inbound/{userId}/{jobId}/{filename}
9. Encolar job email.parse { emailJobId, userId, attachments }
10. Retornar HTTP 200 inmediatamente (Mailgun requiere respuesta rápida)
```

### Lógica crítica — worker email.parse
```
1. Para cada adjunto:
   Si XML:
     a. Parsear XML Factura-e (namespace urn:invoice:...)
     b. Extraer campos: emisor, NIF, fecha, número, concepto, base, IVA, total
     c. Validar estructura XML contra XSD oficial
     d. Si válido → crear draft gasto con campos extraídos
     e. Si inválido → marcar para revisión manual

   Si PDF/imagen:
     a. Crear ocr_job con referencia a email_inbound_id
     b. Encolar ocr.process
     c. Estado emailJob queda PROCESSING hasta OCR done

2. Si sin adjuntos o adjuntos no procesables:
   → status=PENDING_REVIEW, manual=true

3. UPDATE email_inbound_jobs SET status=PENDING_REVIEW, draft_gasto=data
4. Notificar usuario (in-app + push): "Nueva factura recibida: {subject}"
```

### Aislamiento entre usuarios
```
- inbox_hash generado con: HMAC(userId + secret_salt), 12 chars hex
- SELECT siempre filtra por user_id (nunca cross-user)
- R2 paths contienen userId: inbound/{userId}/...
- Adjuntos solo accesibles por el propietario (URL firmadas con userId claim)
```

### Estados email_inbound_jobs
```
PROCESSING → PENDING_REVIEW (adjuntos procesados, esperando usuario)
PENDING_REVIEW → APPROVED (usuario confirma y crea gasto)
PENDING_REVIEW → REJECTED (usuario descarta)
PROCESSING → ERROR (fallo irrecuperable en parseo)
```

### Errores manejados
| Code | Descripción |
|------|-------------|
| EMAIL_HMAC_INVALID | Firma Mailgun inválida — silencioso |
| EMAIL_USER_NOT_FOUND | Hash no corresponde a usuario — silencioso |
| EMAIL_ATTACHMENT_TOO_LARGE | Adjunto >10MB — ignorado con log |
| EMAIL_PARSE_FAILED | Error irrecuperable parseando XML/PDF |
| PLAN_LIMIT | Quota email inbound agotada |

### Jobs emitidos/consumidos
- Emite: `email.parse` al recibir webhook
- Emite: `ocr.process` para adjuntos PDF/imagen
- Consume: `email.parse` en worker (concurrencia 3)

---

## MÓDULO AI-ASSISTANT

**Responsabilidad:** Asistente fiscal conversacional RAG sobre datos del usuario, usando pgvector + Mistral AI EU exclusivamente, con streaming SSE.

### Endpoints

| Método | Ruta | Body | Response | Auth | Rate-limit |
|--------|------|------|----------|------|------------|
| POST | /ai/chat | `{ message, sessionId? }` | SSE stream | JWT | PlanGuard (10/día FREE) |
| GET | /ai/history | `?limit=20` | `AiSession[]` cifradas | JWT | 60/hora |
| DELETE | /ai/history | — | `{ ok: true }` | JWT | 5/día |

### Lógica crítica — /ai/chat
```
1. PlanGuard: verificar ai_queries quota
2. Zod: message ≤2000 chars, sessionId UUID opcional
3. Obtener o crear AiSession { id, user_id, messages=[] }
4. Construir contexto RAG:
   a. Embed query con Mistral Embed API (mistral-embed, EU endpoint)
      POST https://api.mistral.ai/v1/embeddings
   b. SELECT facturas, gastos, IVA últimos 12 meses del usuario
   c. Vectores pre-indexados en pgvector (tabla ai_embeddings)
   d. Buscar los 5 chunks más relevantes:
      SELECT content, metadata FROM ai_embeddings
      WHERE user_id = $userId
      ORDER BY embedding <=> $queryVector
      LIMIT 5
5. Construir prompt sistema:
   "Eres el asistente fiscal de {nombre}. Datos contexto: {chunks_rag}.
    Régimen IVA: {regimen}. Epígrafe IAE: {epigrafe}.
    Responde siempre en español. Citas datos reales del usuario cuando los tienes."
6. Clasificar tipo respuesta esperada:
   - dato_exacto: "¿cuánto IVA llevo este trimestre?"
   - consejo_fiscal: "¿puedo deducir esto?"
   - conversacional: saludos, preguntas generales
7. Llamar Mistral AI (chat/completions, stream=true):
   POST https://api.mistral.ai/v1/chat/completions
   { model: "mistral-large-latest", stream: true, messages: [...] }
8. Hacer pipe SSE al cliente:
   res.raw.write(`data: ${JSON.stringify({ delta, type })}\n\n`)
9. Al finalizar stream:
   a. Guardar mensaje usuario + respuesta completa en AiSession
   b. Cifrar mensajes en DB (AES-256-GCM con key derivado de userId)
   c. Mantener solo últimas 20 conversaciones (DELETE overflow)
   d. INCREMENT usage_tracking(ai_queries_count)
   e. Emitir evento SSE final: { done: true, type, sessionId }
10. Si error Mistral → SSE event de error → cerrar stream
```

### Indexación vectorial (background job)
```
Trigger: al crear/actualizar factura, gasto, payment
1. Serializar entidad a texto descriptivo:
   "Factura F/2026/0042 a ClienteXYZ por 1200€ + IVA 21%
    Fecha: 2026-03-15. Estado: PAID."
2. Embed con mistral-embed
3. UPSERT ai_embeddings { user_id, entity_type, entity_id, content, embedding, updated_at }
```

### Tipos de respuesta SSE
```typescript
// delta durante streaming
{ type: 'delta', delta: string, responseType: 'dato_exacto'|'consejo_fiscal'|'conversacional' }
// fin
{ type: 'done', sessionId: string, tokensUsed: number }
// error
{ type: 'error', code: string, message: string }
```

### Errores manejados
| Code | HTTP/SSE | Descripción |
|------|----------|-------------|
| AI_RATE_LIMITED | 429 | Limite diario del plan alcanzado |
| AI_MISTRAL_UNAVAILABLE | SSE error | Mistral EU no disponible |
| AI_CONTEXT_BUILD_FAILED | SSE error | Error construyendo contexto RAG |
| AI_MESSAGE_TOO_LONG | 422 | Mensaje >2000 chars |

### Jobs emitidos
- Indexación vectorial asíncrona al modificar facturas/gastos

---

## MÓDULO NOTIFICATIONS

**Responsabilidad:** Alertas fiscales, tips y noticias personalizadas por régimen — in-app, push y digest semanal.

### Endpoints

| Método | Ruta | Body | Response | Auth | Rate-limit |
|--------|------|------|------------|------|------------|
| GET | /notifications | `?page&limit&read&type` | `{ items[], unread_count }` | JWT | — |
| PATCH | /notifications/:id/read | — | `Notification` | JWT | — |
| PATCH | /notifications/read-all | — | `{ updated: number }` | JWT | — |
| POST | /notifications/subscribe-push | `{ subscription: PushSubscription }` | `{ ok: true }` | JWT | — |
| DELETE | /notifications/subscribe-push | `{ endpoint }` | `{ ok: true }` | JWT | — |
| GET | /notifications/preferences | — | `NotifPreferences` | JWT | — |
| PATCH | /notifications/preferences | `Partial<NotifPreferences>` | `NotifPreferences` | JWT | — |

### Tipos de notificación
```typescript
enum NotificationType {
  FISCAL_ALERT = 'FISCAL_ALERT',   // fechas AEAT próximas
  TIP = 'TIP',                      // consejo fiscal proactivo
  NEWS = 'NEWS',                    // cambio normativo, AEAT
  SYSTEM = 'SYSTEM',               // sellado, OCR completado
  PROMO = 'PROMO'                  // upgrade de plan
}
```

### Lógica crítica — cron 09:00 (fiscal-dates)
```
Cron: 0 9 * * *
1. SELECT usuarios activos con perfil fiscal completo
2. Cargar calendario AEAT hardcoded (actualizar trimestralmente):
   - 20 ene: IVA 4T anterior (303)
   - 30 ene: IRPF 4T anterior (130/131)
   - 20 abr: IVA 1T (303)
   - 30 abr: IRPF 1T (130/131)
   - 20 jul: IVA 2T
   - 30 jul: IRPF 2T
   - 20 oct: IVA 3T
   - 30 oct: IRPF 3T
   - 31 oct: Modelo 347 anual (info)
3. Para cada usuario:
   a. Filtrar fechas en próximos 7 días relevantes por régimen
   b. Calcular estimación IVA/IRPF a pagar basada en facturas del trimestre
   c. Si alerta ya enviada hoy → skip
   d. INSERT notification { type=FISCAL_ALERT, user_id, title, body, data }
   e. Si web push habilitado → enviar push notification (web-push library)
4. Log: "Fiscal dates cron: {N} notificaciones enviadas"
```

### Lógica crítica — cron digest semanal (lunes 08:00)
```
Cron: 0 8 * * 1
1. SELECT usuarios con email_digest=true
2. Para cada usuario:
   a. Recopilar notificaciones no leídas de la semana anterior
   b. Recopilar resumen fiscal (facturas emitidas, cobradas, IVA acumulado)
   c. Renderizar email HTML con plantilla digest
   d. Enviar via Mailgun EU
   e. Marcar notificaciones como digest_sent=true
```

### Errores manejados
| Code | HTTP | Descripción |
|------|------|-------------|
| NOTIFICATION_NOT_FOUND | 404 | Notificación no existe o no pertenece al usuario |
| PUSH_SUBSCRIPTION_INVALID | 422 | PushSubscription malformada |

### Jobs consumidos
- `notifications.fiscal-dates` cron 09:00 UTC
- `notifications.digest` cron lunes 08:00 UTC

---

## MÓDULO BILLING (prep B6)

**Responsabilidad:** PlanGuard, usage tracking, límites por plan y webhooks Stripe vacíos listos para B6.

### Endpoints

| Método | Ruta | Body | Response | Auth | Rate-limit |
|--------|------|------|----------|------|------------|
| GET | /billing/plan | — | `{ plan, usage, limits }` | JWT | — |
| GET | /billing/usage | `?month=YYYY-MM` | `UsageRecord` | JWT | — |
| POST | /webhooks/stripe | Stripe event | `{ received: true }` | Stripe-Signature | — |

### Planes y límites
```typescript
const PLAN_LIMITS = {
  FREE: {
    invoices_per_month: 5,
    ocr_per_month: 10,
    ai_queries_per_day: 10,
    inbound_emails_per_month: 20,
    storage_mb: 100
  },
  STARTER: {
    invoices_per_month: 30,
    ocr_per_month: 50,
    ai_queries_per_day: 50,
    inbound_emails_per_month: 100,
    storage_mb: 1000
  },
  PRO: {
    invoices_per_month: 200,
    ocr_per_month: 200,
    ai_queries_per_day: -1,  // ilimitado
    inbound_emails_per_month: 500,
    storage_mb: 10000
  },
  AGENCY: {
    invoices_per_month: -1,
    ocr_per_month: -1,
    ai_queries_per_day: -1,
    inbound_emails_per_month: -1,
    storage_mb: -1
  }
}
```

### PlanGuard (Fastify hook pre-handler)
```typescript
// Registro como hook en cada ruta con opción planGuard
fastify.addHook('preHandler', async (request, reply) => {
  const guard = request.routeOptions.config?.planGuard
  if (!guard) return

  const userId = request.user.id
  const plan = request.user.plan
  const limits = PLAN_LIMITS[plan]
  const usage = await getUsageThisPeriod(userId, guard.metric)

  const limit = limits[guard.metric]
  if (limit === -1) return  // ilimitado

  if (usage >= limit) {
    reply.status(429).send({
      error: 'PLAN_LIMIT',
      reason: guard.reason,
      current: usage,
      limit,
      upgradeUrl: 'https://lefse.io/pricing'
    })
    return
  }
})
```

### Lógica crítica — usage tracking
```
1. Clave período: YYYY-MM (mes actual UTC)
2. Al consumir recurso:
   UPDATE usage_tracking
   SET {metric}_count = {metric}_count + 1
   WHERE user_id = $userId AND period_month = $periodMonth
   ON CONFLICT (user_id, period_month)
   DO UPDATE SET {metric}_count = usage_tracking.{metric}_count + 1
3. Para ai_queries: período diario (YYYY-MM-DD)
4. Cache Redis: 'usage:{userId}:{period}:{metric}' TTL 60s
   Invalidar al escribir en DB
```

### Webhooks Stripe (vacíos, listos para B6)
```typescript
// POST /webhooks/stripe
// Verificar: stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)
const handlers: Record<string, (event: Stripe.Event) => Promise<void>> = {
  'customer.subscription.created': async (e) => { /* TODO B6 */ },
  'customer.subscription.updated': async (e) => { /* TODO B6 */ },
  'customer.subscription.deleted': async (e) => { /* TODO B6 */ },
  'invoice.payment_succeeded': async (e) => { /* TODO B6 */ },
  'invoice.payment_failed': async (e) => { /* TODO B6 */ },
  'checkout.session.completed': async (e) => { /* TODO B6 */ },
}
```

### Errores manejados
| Code | HTTP | Descripción |
|------|------|-------------|
| PLAN_LIMIT | 429 | Límite del plan alcanzado |
| STRIPE_WEBHOOK_INVALID | 400 | Firma Stripe inválida |

---

## BASE DE DATOS — MIGRACIONES

### Orden de ejecución (respeta FK)
```
001_users
002_refresh_tokens
003_invoice_series
004_invoices
005_verifactu_records + trigger
006_ocr_jobs
007_email_inbound_jobs
008_ai_sessions + ai_embeddings
009_notifications + push_subscriptions
010_billing_usage_tracking
011_audit_log
012_indexes
```

### 001_users.sql
```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TYPE user_plan AS ENUM ('FREE', 'STARTER', 'PRO', 'AGENCY');
CREATE TYPE user_role AS ENUM ('user', 'admin');

CREATE TABLE users (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email           TEXT NOT NULL UNIQUE,
  email_verified  BOOLEAN NOT NULL DEFAULT false,
  password_hash   TEXT,
  name            TEXT NOT NULL,
  role            user_role NOT NULL DEFAULT 'user',
  plan            user_plan NOT NULL DEFAULT 'FREE',
  -- Fiscal
  nif             TEXT,
  nombre_fiscal   TEXT,
  regimen_iva     TEXT,
  epigrafe_iae    TEXT,
  tipo_irpf       TEXT DEFAULT '15',
  actividad       TEXT,
  domicilio_fiscal JSONB,
  -- Email inbound
  inbox_hash      TEXT UNIQUE,
  -- OAuth
  google_id       TEXT UNIQUE,
  -- 2FA
  totp_secret     TEXT,
  totp_enabled    BOOLEAN NOT NULL DEFAULT false,
  backup_codes    TEXT[],
  -- Meta
  stripe_customer_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_inbox_hash ON users(inbox_hash) WHERE inbox_hash IS NOT NULL;
CREATE INDEX idx_users_nif ON users(nif) WHERE nif IS NOT NULL AND deleted_at IS NULL;
```

### 002_refresh_tokens.sql
```sql
CREATE TABLE refresh_tokens (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  ip          TEXT,
  user_agent  TEXT,
  revoked     BOOLEAN NOT NULL DEFAULT false,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
```

### 003_invoice_series.sql
```sql
CREATE TABLE invoice_series (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prefix          TEXT NOT NULL,
  last_sequence   INTEGER NOT NULL DEFAULT 0,
  reset_yearly    BOOLEAN NOT NULL DEFAULT true,
  current_year    INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, prefix)
);
```

### 004_invoices.sql
```sql
CREATE TYPE invoice_status AS ENUM (
  'DRAFT', 'PENDING_SEAL', 'SEALED', 'SENT', 'PAID', 'VOID'
);
CREATE TYPE invoice_type AS ENUM ('F1', 'F2', 'R', 'R1', 'R2', 'R3', 'R4', 'R5');

CREATE TABLE invoices (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id             TEXT NOT NULL REFERENCES users(id),
  serie_id            TEXT REFERENCES invoice_series(id),
  numero_factura      TEXT NOT NULL,
  tipo                invoice_type NOT NULL DEFAULT 'F1',
  estado              invoice_status NOT NULL DEFAULT 'DRAFT',
  -- Cliente
  cliente_nombre      TEXT NOT NULL,
  cliente_nif         TEXT,
  cliente_email       TEXT,
  cliente_domicilio   TEXT,
  -- Fechas
  fecha_emision       DATE NOT NULL,
  fecha_vencimiento   DATE,
  -- Totales (calculados, inmutables tras seal)
  base_imponible      NUMERIC(12,2),
  total_iva           NUMERIC(12,2),
  total_irpf          NUMERIC(12,2),
  total_factura       NUMERIC(12,2),
  moneda              TEXT NOT NULL DEFAULT 'EUR',
  -- Líneas
  lineas              JSONB NOT NULL DEFAULT '[]',
  -- Contenido
  concepto            TEXT,
  notas               TEXT,
  -- Verifactu
  verifactu_csv       TEXT,
  sealed_at           TIMESTAMPTZ,
  locked_at           TIMESTAMPTZ,
  -- Rectificativa
  rectificativa_de    TEXT REFERENCES invoices(id),
  rectificativa_id    TEXT REFERENCES invoices(id),
  -- PDF
  pdf_r2_key          TEXT,
  -- Email
  sent_at             TIMESTAMPTZ,
  sent_to             TEXT,
  -- Pago
  paid_at             TIMESTAMPTZ,
  paid_method         TEXT,
  -- Meta
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, numero_factura)
);

CREATE INDEX idx_invoices_user ON invoices(user_id);
CREATE INDEX idx_invoices_estado ON invoices(user_id, estado);
CREATE INDEX idx_invoices_fecha ON invoices(user_id, fecha_emision DESC);
CREATE INDEX idx_invoices_numero ON invoices(user_id, numero_factura);
```

### 005_verifactu_records.sql
```sql
CREATE TYPE verifactu_estado AS ENUM (
  'PENDING', 'SENT', 'ACCEPTED', 'ACCEPTED_WITH_ERRORS', 'REJECTED', 'ERROR'
);

CREATE TABLE verifactu_records (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  invoice_id          TEXT NOT NULL REFERENCES invoices(id),
  user_id             TEXT NOT NULL REFERENCES users(id),
  xml_generado        TEXT NOT NULL,
  xml_firmado         TEXT,
  huella              TEXT NOT NULL,
  prev_huella         TEXT,
  numero_factura      TEXT NOT NULL,
  fecha_emision       DATE NOT NULL,
  csv_aeat            TEXT,
  estado_aeat         verifactu_estado NOT NULL DEFAULT 'PENDING',
  respuesta_aeat_raw  JSONB,
  enviado_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- NO updated_at, NO deleted_at — append-only
);

-- Trigger append-only
CREATE OR REPLACE FUNCTION verifactu_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    RAISE EXCEPTION 'verifactu_records es append-only: UPDATE no permitido en id=%', OLD.id;
  END IF;
  IF (TG_OP = 'DELETE') THEN
    RAISE EXCEPTION 'verifactu_records es append-only: DELETE no permitido en id=%', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER verifactu_immutable_trigger
BEFORE UPDATE OR DELETE ON verifactu_records
FOR EACH ROW EXECUTE FUNCTION verifactu_immutable();

CREATE INDEX idx_verifactu_invoice ON verifactu_records(invoice_id);
CREATE INDEX idx_verifactu_user ON verifactu_records(user_id, created_at DESC);
CREATE INDEX idx_verifactu_huella ON verifactu_records(huella);
```

### 006_ocr_jobs.sql
```sql
CREATE TYPE ocr_status AS ENUM ('QUEUED', 'PROCESSING', 'DONE', 'ERROR');

CREATE TABLE ocr_jobs (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id             TEXT NOT NULL REFERENCES users(id),
  email_inbound_id    TEXT,
  r2_key              TEXT,
  status              ocr_status NOT NULL DEFAULT 'QUEUED',
  result              JSONB,
  error               TEXT,
  processed_at        TIMESTAMPTZ,
  image_deleted_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ocr_jobs_user ON ocr_jobs(user_id, created_at DESC);
CREATE INDEX idx_ocr_jobs_cleanup ON ocr_jobs(created_at)
  WHERE r2_key IS NOT NULL AND image_deleted_at IS NULL;
```

### 007_email_inbound_jobs.sql
```sql
CREATE TYPE email_inbound_status AS ENUM (
  'PROCESSING', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ERROR'
);

CREATE TABLE email_inbound_jobs (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         TEXT NOT NULL REFERENCES users(id),
  from_address    TEXT NOT NULL,
  subject         TEXT,
  body_text       TEXT,
  body_html       TEXT,
  attachments     JSONB NOT NULL DEFAULT '[]',
  status          email_inbound_status NOT NULL DEFAULT 'PROCESSING',
  draft_gasto     JSONB,
  gasto_id        TEXT,
  reject_reason   TEXT,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_inbound_user ON email_inbound_jobs(user_id, created_at DESC);
CREATE INDEX idx_email_inbound_status ON email_inbound_jobs(user_id, status);
```

### 008_ai_sessions.sql
```sql
CREATE TABLE ai_sessions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  messages        BYTEA NOT NULL DEFAULT '',  -- AES-256-GCM cifrado
  messages_iv     TEXT,
  message_count   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ai_embeddings (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,  -- 'invoice', 'gasto', 'payment'
  entity_id       TEXT NOT NULL,
  content         TEXT NOT NULL,
  embedding       vector(1024) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, entity_type, entity_id)
);

CREATE INDEX idx_ai_sessions_user ON ai_sessions(user_id, updated_at DESC);
CREATE INDEX idx_ai_embeddings_user ON ai_embeddings(user_id);
CREATE INDEX idx_ai_embeddings_vector ON ai_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 009_notifications.sql
```sql
CREATE TYPE notification_type AS ENUM (
  'FISCAL_ALERT', 'TIP', 'NEWS', 'SYSTEM', 'PROMO'
);

CREATE TABLE notifications (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            notification_type NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  data            JSONB DEFAULT '{}',
  read            BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  digest_sent     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE push_subscriptions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint        TEXT NOT NULL UNIQUE,
  p256dh          TEXT NOT NULL,
  auth            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notification_preferences (
  user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  fiscal_alerts   BOOLEAN NOT NULL DEFAULT true,
  tips            BOOLEAN NOT NULL DEFAULT true,
  news            BOOLEAN NOT NULL DEFAULT true,
  push_enabled    BOOLEAN NOT NULL DEFAULT false,
  email_digest    BOOLEAN NOT NULL DEFAULT true,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read)
  WHERE read = false;
```

### 010_billing_usage_tracking.sql
```sql
CREATE TABLE usage_tracking (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id                     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_month                TEXT NOT NULL,  -- 'YYYY-MM' o 'YYYY-MM-DD' para AI daily
  invoices_count              INTEGER NOT NULL DEFAULT 0,
  ocr_count                   INTEGER NOT NULL DEFAULT 0,
  ai_queries_count            INTEGER NOT NULL DEFAULT 0,
  inbound_emails_count        INTEGER NOT NULL DEFAULT 0,
  storage_bytes               BIGINT NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, period_month)
);

CREATE INDEX idx_usage_user_period ON usage_tracking(user_id, period_month DESC);
```

### 011_audit_log.sql
```sql
CREATE TABLE audit_log (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         TEXT REFERENCES users(id),
  action          TEXT NOT NULL,
  entity          TEXT,
  entity_id       TEXT,
  payload_hash    TEXT,
  ip              TEXT,
  user_agent      TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- NO updated_at — INSERT-only
);

-- Trigger append-only
CREATE OR REPLACE FUNCTION audit_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
    RAISE EXCEPTION 'audit_log es append-only';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_log_immutable_trigger
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_entity ON audit_log(entity, entity_id);
CREATE INDEX idx_audit_log_action ON audit_log(action, created_at DESC);
```

---

## JOBS & COLAS BULLMQ

### Configuración de colas
```typescript
// queues/index.ts
import { Queue, Worker } from 'bullmq'
import { redis } from '../lib/redis'

export const queues = {
  verifactu:     new Queue('verifactu.submit',          { connection: redis }),
  ocr:           new Queue('ocr.process',               { connection: redis }),
  emailParse:    new Queue('email.parse',               { connection: redis }),
  fiscalDates:   new Queue('notifications.fiscal-dates', { connection: redis }),
  digest:        new Queue('notifications.digest',       { connection: redis }),
  ocrCleanup:    new Queue('ocr.cleanup',               { connection: redis }),
}

// Workers con concurrencia
new Worker('verifactu.submit',           verifactuWorker,    { connection: redis, concurrency: 2  })
new Worker('ocr.process',               ocrWorker,           { connection: redis, concurrency: 5  })
new Worker('email.parse',               emailParseWorker,    { connection: redis, concurrency: 3  })
new Worker('notifications.fiscal-dates', fiscalDatesWorker,  { connection: redis, concurrency: 1  })
new Worker('notifications.digest',       digestWorker,       { connection: redis, concurrency: 1  })
new Worker('ocr.cleanup',              ocrCleanupWorker,     { connection: redis, concurrency: 1  })
```

### Crons con BullMQ
```typescript
// Fiscal dates: todos los días 09:00 UTC
queues.fiscalDates.add('run', {}, {
  repeat: { pattern: '0 9 * * *', tz: 'UTC' }
})

// Digest semanal: lunes 08:00 UTC
queues.digest.add('run', {}, {
  repeat: { pattern: '0 8 * * 1', tz: 'UTC' }
})

// OCR cleanup: diario 02:00 UTC
queues.ocrCleanup.add('run', {}, {
  repeat: { pattern: '0 2 * * *', tz: 'UTC' }
})
```

### Política de reintentos
```typescript
// verifactu.submit: backoff exponencial
const verifactuJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: 86400 * 7 },
  removeOnFail: false
}

// ocr.process: 2 reintentos lineales
const ocrJobOptions = {
  attempts: 2,
  backoff: { type: 'fixed', delay: 3000 },
  removeOnComplete: { age: 86400 * 3 }
}

// email.parse: 3 reintentos
const emailJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 }
}
```

---

## TESTS OBLIGATORIOS

### Unit — validación NIF/CIF
```typescript
// tests/unit/nif-validation.test.ts
describe('validateNIF', () => {
  // NIF persona física válidos
  it('acepta NIF válido: 12345678Z', () => expect(validateNIF('12345678Z')).toBe(true))
  it('acepta NIF válido: 00000000T', () => expect(validateNIF('00000000T')).toBe(true))
  it('rechaza NIF letra incorrecta: 12345678A', () => expect(validateNIF('12345678A')).toBe(false))
  it('rechaza NIF longitud incorrecta: 1234567Z', () => expect(validateNIF('1234567Z')).toBe(false))

  // NIE válidos
  it('acepta NIE: X1234567L', () => expect(validateNIF('X1234567L')).toBe(true))
  it('acepta NIE: Y9999999R', () => expect(validateNIF('Y9999999R')).toBe(true))
  it('acepta NIE: Z0000001M', () => expect(validateNIF('Z0000001M')).toBe(true))
  it('rechaza NIE letra incorrecta', () => expect(validateNIF('X1234567A')).toBe(false))

  // CIF empresa válidos
  it('acepta CIF: B83267893', () => expect(validateNIF('B83267893')).toBe(true))
  it('acepta CIF con letra control: A28015497', () => expect(validateNIF('A28015497')).toBe(true))
  it('rechaza CIF con dígito control incorrecto', () => expect(validateNIF('B83267890')).toBe(false))

  // Casos borde
  it('rechaza null', () => expect(validateNIF(null)).toBe(false))
  it('rechaza empty string', () => expect(validateNIF('')).toBe(false))
  it('rechaza espacios', () => expect(validateNIF(' 12345678Z')).toBe(false))
  it('normaliza minúsculas: 12345678z', () => expect(validateNIF('12345678z')).toBe(true))
})
```

### Unit — cálculo IVA/IRPF
```typescript
// tests/unit/invoice-calculation.test.ts
describe('calculateInvoiceTotals', () => {
  it('calcula correctamente IVA 21%', () => {
    const result = calculate([{ qty: 1, price: 100, iva: 21, irpf: 0 }])
    expect(result.base_imponible).toBe(100.00)
    expect(result.total_iva).toBe(21.00)
    expect(result.total_factura).toBe(121.00)
  })

  it('redondeo ROUND_HALF_UP 2 decimales', () => {
    const result = calculate([{ qty: 3, price: 33.333, iva: 21, irpf: 0 }])
    expect(result.base_imponible).toBe(99.99)
    expect(result.total_iva).toBe(21.00)  // 99.999 * 0.21 = 20.999... → 21.00
  })

  it('calcula IRPF 15%', () => {
    const result = calculate([{ qty: 1, price: 1000, iva: 21, irpf: 15 }])
    expect(result.base_imponible).toBe(1000.00)
    expect(result.total_iva).toBe(210.00)
    expect(result.total_irpf).toBe(150.00)
    expect(result.total_factura).toBe(1060.00)  // 1000 + 210 - 150
  })

  it('IVA 0%', () => {
    const result = calculate([{ qty: 5, price: 200, iva: 0, irpf: 0 }])
    expect(result.total_iva).toBe(0.00)
    expect(result.total_factura).toBe(1000.00)
  })

  it('múltiples líneas con distintos tipos IVA', () => {
    const result = calculate([
      { qty: 1, price: 100, iva: 21, irpf: 0 },
      { qty: 2, price: 50,  iva: 10, irpf: 0 }
    ])
    expect(result.base_imponible).toBe(200.00)
    expect(result.total_iva).toBe(31.00)  // 21 + 10
    expect(result.total_factura).toBe(231.00)
  })
})
```

### Unit — hash Verifactu SHA-256 encadenado
```typescript
// tests/unit/verifactu-hash.test.ts
describe('verifactuHash', () => {
  it('genera hash SHA-256 correcto', () => {
    const campos = {
      emisor: 'B83267893',
      numero: 'A/2026/0001',
      fecha: '01-01-2026',
      tipo: 'F1',
      cuotaTotal: '21.00',
      importeTotal: '121.00',
      prevHash: null
    }
    const hash = generateVerifactuHash(campos)
    expect(hash).toHaveLength(64)  // SHA-256 hex
    expect(hash).toMatch(/^[A-F0-9]{64}$/)  // uppercase hex
  })

  it('encadenamiento correcto: hash2 incluye hash1', () => {
    const hash1 = generateVerifactuHash({ ...campos1, prevHash: null })
    const hash2 = generateVerifactuHash({ ...campos2, prevHash: hash1 })
    // hash2 debe ser diferente a hash1
    expect(hash2).not.toBe(hash1)
    // Recalcular hash2 con mismo prevHash debe dar igual resultado
    expect(generateVerifactuHash({ ...campos2, prevHash: hash1 })).toBe(hash2)
  })

  it('cambio mínimo en campos produce hash diferente', () => {
    const h1 = generateVerifactuHash({ ...campos, importeTotal: '121.00', prevHash: null })
    const h2 = generateVerifactuHash({ ...campos, importeTotal: '121.01', prevHash: null })
    expect(h1).not.toBe(h2)
  })
})
```

### Unit — parser XML Factura-e
```typescript
// tests/unit/facturae-parser.test.ts
describe('parseFacturaE', () => {
  it('extrae emisor y NIF correctamente', async () => {
    const xml = readFixture('facturae-sample.xml')
    const result = await parseFacturaE(xml)
    expect(result.emisor_nombre).toBe('Empresa Ejemplo SL')
    expect(result.emisor_nif).toBe('B83267893')
  })

  it('extrae totales fiscales', async () => {
    const result = await parseFacturaE(readFixture('facturae-sample.xml'))
    expect(result.base_imponible).toBe(1000.00)
    expect(result.tipo_iva).toBe('21')
    expect(result.cuota_iva).toBe(210.00)
    expect(result.total_factura).toBe(1210.00)
  })

  it('lanza error con XML malformado', async () => {
    await expect(parseFacturaE('<invalid>')).rejects.toThrow('FACTURAE_PARSE_ERROR')
  })

  it('lanza error si falta namespace urn:invoice', async () => {
    await expect(parseFacturaE(readFixture('xml-sin-namespace.xml')))
      .rejects.toThrow('FACTURAE_INVALID_NAMESPACE')
  })
})
```

### Integration — flujo factura→seal→AEAT sandbox
```typescript
// tests/integration/verifactu-flow.test.ts
describe('Flujo completo Verifactu', () => {
  it('crea factura, sella, envía a AEAT sandbox y registra', async () => {
    // 1. Crear usuario con perfil fiscal completo
    const user = await createTestUser({ plan: 'PRO', fiscalComplete: true })

    // 2. Crear factura DRAFT
    const invoice = await api.post('/invoices', {
      ...invoiceFixture,
      headers: { Authorization: `Bearer ${user.token}` }
    })
    expect(invoice.status).toBe('DRAFT')

    // 3. Sellar
    const sealed = await api.post(`/invoices/${invoice.id}/seal`, {}, {
      headers: { Authorization: `Bearer ${user.token}` }
    })
    expect(sealed.status).toBe('PENDING_SEAL')

    // 4. Esperar job Verifactu (test environment: synchronous worker)
    await processVerifactuJob(invoice.id)

    // 5. Verificar estado final
    const final = await api.get(`/invoices/${invoice.id}`)
    expect(final.status).toBe('SEALED')
    expect(final.verifactu_csv).toBeTruthy()

    // 6. Verificar registro Verifactu inmutable
    const records = await api.get(`/verifactu/audit-trail/${invoice.id}`)
    expect(records).toHaveLength(1)
    expect(records[0].estado_aeat).toBe('ACCEPTED')
    expect(records[0].huella).toHaveLength(64)

    // 7. Verificar que UPDATE en verifactu_records lanza excepción
    await expect(
      db.query(`UPDATE verifactu_records SET estado_aeat='REJECTED' WHERE id=$1`, [records[0].id])
    ).rejects.toThrow('verifactu_records es append-only')
  })
})
```

---

## .env.example
```bash
# ================================
# LEFSE — Variables de entorno
# ================================

# === APP ===
NODE_ENV=development                     # development | production | test
PORT=3000                                # Puerto del servidor Fastify
APP_URL=https://lefse.io                 # URL pública de la aplicación
API_URL=https://api.lefse.io             # URL pública de la API

# === JWT ===
JWT_PRIVATE_KEY=...                      # RS256 private key PEM (base64)
JWT_PUBLIC_KEY=...                       # RS256 public key PEM (base64)
JWT_ACCESS_TTL=900                       # Expiración access token en segundos (15min)
JWT_REFRESH_TTL=604800                   # Expiración refresh token en segundos (7d)

# === DATABASE (PostgreSQL 16 EU Frankfurt) ===
DATABASE_URL=postgresql://user:pass@host:5432/lefse?sslmode=require
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# === REDIS (BullMQ + Rate limiting EU Frankfurt) ===
REDIS_URL=redis://user:pass@host:6379

# === UANATACA eIDAS (QTSP España) ===
UANATACA_API_URL=https://api.uanataca.com
UANATACA_API_KEY=...                     # API key del servicio de firma
UANATACA_CERTIFICATE_ID=...             # ID del certificado eIDAS cualificado

# === AEAT Verifactu ===
AEAT_VERIFACTU_URL=https://prewww1.aeat.es/wlpl/TIKE-CONT/ws  # Sandbox
# AEAT_VERIFACTU_URL=https://www1.aeat.es/wlpl/TIKE-CONT/ws   # Producción
AEAT_TIMEOUT_MS=30000                    # Timeout llamadas AEAT

# === MINDEE OCR (Francia EU) ===
MINDEE_API_KEY=...                       # API key Mindee
MINDEE_API_URL=https://api.mindee.net/v1

# === MISTRAL AI (París EU) ===
MISTRAL_API_KEY=...                      # API key Mistral
MISTRAL_API_URL=https://api.mistral.ai/v1
MISTRAL_MODEL=mistral-large-latest       # Modelo para chat
MISTRAL_EMBED_MODEL=mistral-embed        # Modelo para embeddings

# === MAILGUN (EU Frankfurt) ===
MAILGUN_API_KEY=...                      # API key Mailgun
MAILGUN_DOMAIN=lefse.io                  # Dominio configurado en Mailgun
MAILGUN_EU_API_URL=https://api.eu.mailgun.net
MAILGUN_WEBHOOK_SIGNING_KEY=...         # Signing key para verificar webhooks HMAC
MAILGUN_INBOX_DOMAIN=inbox.lefse.io     # Dominio para emails inbound

# === CLOUDFLARE R2 (almacenamiento EU) ===
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=lefse-files
R2_PUBLIC_URL=https://files.lefse.io    # URL pública del bucket (si aplica)

# === STRIPE (prep B6) ===
STRIPE_SECRET_KEY=sk_test_...           # Clave secreta Stripe (test)
STRIPE_PUBLISHABLE_KEY=pk_test_...      # Clave pública Stripe
STRIPE_WEBHOOK_SECRET=whsec_...        # Secret para verificar webhooks

# === WEB PUSH (notificaciones push) ===
VAPID_PUBLIC_KEY=...                    # Clave pública VAPID
VAPID_PRIVATE_KEY=...                   # Clave privada VAPID
VAPID_SUBJECT=mailto:tech@lefse.io

# === ENCRYPTION (RGPD) ===
ENCRYPTION_KEY=...                      # AES-256 key hex (64 chars) para historial AI
RGPD_ANON_SALT=...                      # Salt para pseudoanonimización NIF

# === EMAIL INBOUND ===
INBOX_HASH_SECRET=...                   # Secret HMAC para generar hashes inbox

# === RATE LIMITING ===
RATE_LIMIT_WINDOW_MS=60000              # Ventana rate limit global en ms
RATE_LIMIT_MAX_FREE=100                 # Máx requests/ventana plan FREE

# === LOGGING ===
LOG_LEVEL=info                          # trace | debug | info | warn | error
LOG_FORMAT=json                         # json | pretty (pretty solo en dev)

# === GOOGLE OAUTH2 ===
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://api.lefse.io/auth/google/callback

# === LEFSE SISTEMA ===
LEFSE_NIF=B-XXXXXXXX                    # NIF de Lefse SL para Verifactu SistemaInformatico
LEFSE_NOMBRE=Lefse SL
LEFSE_VERSION=1.0
```
