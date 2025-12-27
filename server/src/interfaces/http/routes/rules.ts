import { Router, Request, Response } from 'express';
import type { RuleService } from '../../../application/rules/ruleService';
import { toRuleListResponseDTO, toRuleRequestDTO, toRuleResponseDTO } from '../dto/rules';

export const createRulesRouter = ({ service }: { service: RuleService }): Router => {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    const rules = await service.list();
    res.json(toRuleListResponseDTO(rules));
  });

  router.post('/', async (req: Request, res: Response) => {
    const payload = toRuleRequestDTO(req.body);
    const result = await service.create(payload);

    if (!result.ok) {
      res.status(400).json({ error: result.message });
      return;
    }

    res.status(201).json(toRuleResponseDTO(result.rule));
  });

  router.put('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const payload = toRuleRequestDTO(req.body);
    const result = await service.update(id, payload);

    if (!result.ok) {
      if (result.error === 'not_found') {
        res.status(404).json({ error: result.message });
      } else {
        res.status(400).json({ error: result.message });
      }
      return;
    }

    res.json(toRuleResponseDTO(result.rule));
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await service.remove(id);

    if (!result.ok) {
      res.status(404).json({ error: result.message });
      return;
    }

    res.status(204).send();
  });

  return router;
};
