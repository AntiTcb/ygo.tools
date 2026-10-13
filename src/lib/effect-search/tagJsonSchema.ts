import { z } from 'zod';
import { tagOutputSchema, type Vocab } from './tagSchema';

type JsonSchema = Record<string, unknown>;

const isObject = (v: unknown): v is JsonSchema => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Walks every object schema, letting `visit` patch its `properties`. */
const walk = (node: unknown, visit: (props: JsonSchema) => void): void => {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, visit));
  if (!isObject(node)) return;
  if (isObject(node.properties)) visit(node.properties);
  for (const v of Object.values(node)) walk(v, visit);
};

const enumOf = (values: readonly string[]) => ({ type: 'string', enum: [...values] });

/**
 * JSON schema for the model's `response_format`: the tagger output schema with verb/event/zone
 * strings narrowed to the current vocabulary, so constrained decoding can't invent terms
 * (new terms go through `unmapped` instead).
 */
export const buildTagJsonSchema = (vocab: Vocab): JsonSchema => {
  const schema = z.toJSONSchema(tagOutputSchema, { io: 'input', target: 'draft-2020-12' }) as JsonSchema;
  delete schema.$schema;
  walk(schema, (props) => {
    if ('verb' in props && 'is_cost' in props) props.verb = enumOf(vocab.actionVerbs);
    if ('event' in props && 'subject_is_self' in props) props.event = enumOf(vocab.eventVerbs);
    for (const key of ['from_zones', 'to_zones'] as const) {
      if (key in props && 'verb' in props) props[key] = { type: 'array', items: enumOf(vocab.zones) };
      if (key === 'from_zones' && key in props && 'event' in props) props[key] = { type: 'array', items: enumOf(vocab.zones) };
    }
  });
  return schema;
};
