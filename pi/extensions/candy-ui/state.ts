export interface ModelRef { provider: string; id: string; name: string }
export const modelKey = (model: ModelRef) => `${model.provider}/${model.id}`;

export function selectModels<T extends ModelRef>(available: T[], scope: readonly { model: ModelRef }[]): T[] {
  const allowed = scope.length ? new Set(scope.map(({ model }) => modelKey(model))) : undefined;
  const seen = new Set<string>();
  return available.filter((model) => {
    const key = modelKey(model);
    if (seen.has(key) || (allowed && !allowed.has(key))) return false;
    seen.add(key);
    return true;
  });
}

export function filterModels<T extends ModelRef>(models: T[], query: string): T[] {
  const words = query.toLocaleLowerCase().trim().split(/\s+/);
  return models.filter((model) => words.every((word) =>
    `${model.name} ${model.provider} ${model.id}`.toLocaleLowerCase().includes(word)));
}

export function moveIndex(index: number, delta: number, count: number): number {
  return count ? ((index + delta) % count + count) % count : -1;
}

export class Activity {
  active = false;
  compacting = false;
  failed = false;
  cancelled = false;
  started = 0;
  private tools = new Map<string, string>();
  start(): void {
    this.active = true; this.failed = false; this.cancelled = false;
    this.started = Date.now(); this.tools.clear();
  }
  toolStart(id: string, name: string): void { this.tools.set(id, name); }
  toolEnd(id: string, error: boolean): void { this.tools.delete(id); this.failed ||= error; }
  settle(): void { this.active = false; this.tools.clear(); }
  label(): string {
    if (this.compacting) return "Compacting context";
    if (this.tools.size) {
      const names = [...new Set(this.tools.values())].join(", ");
      return `Running ${names}${this.tools.size > 1 ? ` (${this.tools.size})` : ""}`;
    }
    if (this.active) return "Working";
    if (this.cancelled) return "Cancelled";
    if (this.failed) return "Finished with errors";
    return "Ready";
  }
}
