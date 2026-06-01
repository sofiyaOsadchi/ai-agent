(() => {
  const CONTRACT_VERSION = "assistant-tool-contract.v1";

  function compact(value) {
    return String(value ?? "").trim();
  }

  function fieldHasValue(value) {
    if (Array.isArray(value)) return value.filter(Boolean).length > 0;
    if (value === true || value === false) return true;
    return compact(value).length > 0;
  }

  function normalizeField(field = {}, required = false) {
    return {
      ...field,
      key: compact(field.key),
      label: field.label || field.key || "",
      type: field.type || "text",
      required: field.required === false ? false : required
    };
  }

  function normalizeFields(tool = {}) {
    const requiredFields = (tool.requiredInputs || []).map((field) => normalizeField(field, true));
    const optionalFields = (tool.optionalInputs || []).map((field) => normalizeField(field, false));
    return [...requiredFields, ...optionalFields].filter((field) => field.key);
  }

  function validateFields(fields = [], values = {}) {
    const missingFields = fields
      .filter((field) => field.required !== false && !fieldHasValue(values[field.key]))
      .map((field) => field.key);

    return {
      valid: missingFields.length === 0,
      missingFields,
      warnings: [],
      errors: []
    };
  }

  function defaultValidate(tool, values) {
    return validateFields(tool.fields || normalizeFields(tool), values);
  }

  function defaultBuildPayload(tool, values, context = {}) {
    if (typeof tool.payloadBuilder === "function") return tool.payloadBuilder(values, context);
    if (typeof tool.buildPayload === "function") return tool.buildPayload(values, context);
    return { mode: tool.mode || tool.id, ...values };
  }

  function defaultRunPolicy(tool, values, payload = {}, context = {}) {
    const validation = context.validation || defaultValidate(tool, values);
    const risk = compact(tool.risk || "draft");
    const canRunDirectly = Boolean(tool.canRunDirectly) && validation.valid;
    const requiresConfirmation = /writes|creates|cost|ai|crawl|audit/i.test(risk);

    return {
      canRunDirectly,
      requiresWorkspace: !canRunDirectly,
      requiresConfirmation,
      mode: payload.mode || tool.mode || tool.id,
      risk,
      reasons: validation.errors || [],
      warnings: validation.warnings || []
    };
  }

  function createResultModel(input = {}) {
    return {
      id: input.id || `result-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      toolId: input.toolId || "",
      title: input.title || "Generated output",
      description: input.description || "",
      type: input.type || "result",
      url: input.url || "",
      status: input.status || "ready",
      createdAt: input.createdAt || new Date().toISOString(),
      metadata: input.metadata || {}
    };
  }

  function defaultResultPolicy(resultOrEvent = {}, context = {}) {
    return createResultModel({
      toolId: context.toolId || resultOrEvent.toolId || "",
      title: resultOrEvent.title || resultOrEvent.kind || "Generated output",
      description: resultOrEvent.description || resultOrEvent.fileName || "",
      type: resultOrEvent.type || "result",
      url: resultOrEvent.url || "",
      metadata: resultOrEvent
    });
  }

  const schemaBuilderAdapter = {
    runPolicy(tool, values, payload = {}, context = {}) {
      const validation = context.validation || defaultValidate(tool, values);
      const previewOnly = payload.previewOnly !== false;
      return {
        canRunDirectly: Boolean(tool.canRunDirectly) && validation.valid,
        requiresWorkspace: false,
        requiresConfirmation: !previewOnly,
        mode: payload.mode || "schema-builder",
        risk: previewOnly ? "preview" : "writes-to-sheet",
        reasons: validation.errors || [],
        warnings: validation.warnings || []
      };
    },
    resultPolicy(result = {}, context = {}) {
      const wroteToSheet = Array.isArray(result.results) && result.results.some((item) => item?.wroteToSheet);
      return createResultModel({
        toolId: "schema-builder",
        title: wroteToSheet ? "Schema written to Google Sheet" : "Schema preview ready",
        description: `${result.generated || 0} target(s), ${result.totalQuestions || 0} questions`,
        type: wroteToSheet ? "google-sheet" : "preview",
        status: "ready",
        metadata: result
      });
    }
  };

  const designFormattingAdapter = {
    runPolicy(tool, values, payload = {}, context = {}) {
      const validation = context.validation || defaultValidate(tool, values);
      const dryRun = payload.dryRun !== false;
      return {
        canRunDirectly: Boolean(tool.canRunDirectly) && validation.valid,
        requiresWorkspace: false,
        requiresConfirmation: !dryRun,
        mode: payload.mode || "design-formatting",
        risk: dryRun ? "dry-run" : "writes-to-sheet",
        reasons: validation.errors || [],
        warnings: validation.warnings || []
      };
    },
    resultPolicy(result = {}, context = {}) {
      return createResultModel({
        toolId: "design-formatting",
        title: context.dryRun ? "FAQ editing dry run ready" : "FAQ editing run finished",
        description: result.description || result.summary || "",
        type: context.dryRun ? "dry-run" : "sheet-preview-or-write",
        status: "ready",
        metadata: result
      });
    }
  };

  const builtInAdapters = {
    "schema-builder": schemaBuilderAdapter,
    "design-formatting": designFormattingAdapter
  };

  function normalizeTool(tool = {}, adapter = builtInAdapters[tool.id] || {}) {
    const fields = normalizeFields(tool);
    const contract = {
      version: CONTRACT_VERSION,
      fields,
      validate(values = {}, context = {}) {
        const validate = adapter.validate || defaultValidate;
        return validate({ ...tool, fields }, values, context);
      },
      buildPayload(values = {}, context = {}) {
        const buildPayload = adapter.buildPayload || defaultBuildPayload;
        return buildPayload({ ...tool, fields }, values, context);
      },
      runPolicy(values = {}, payload = {}, context = {}) {
        const validation = context.validation || this.validate(values, context);
        const runPolicy = adapter.runPolicy || defaultRunPolicy;
        return runPolicy({ ...tool, fields }, values, payload, { ...context, validation });
      },
      resultPolicy(resultOrEvent = {}, context = {}) {
        const resultPolicy = adapter.resultPolicy || defaultResultPolicy;
        return resultPolicy(resultOrEvent, { ...context, toolId: tool.id });
      }
    };

    return {
      ...tool,
      fields,
      validate: contract.validate.bind(contract),
      buildPayload: contract.buildPayload.bind(contract),
      runPolicy: contract.runPolicy.bind(contract),
      resultPolicy: contract.resultPolicy.bind(contract),
      contract
    };
  }

  window.CarmelonAssistantToolContract = {
    CONTRACT_VERSION,
    builtInAdapters,
    compact,
    fieldHasValue,
    normalizeField,
    normalizeFields,
    validateFields,
    createResultModel,
    normalizeTool
  };
})();
