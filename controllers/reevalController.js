import { submitReevaluation } from "../services/reevalService.js";

export const submitReevaluationController = async (req, res) => {
  try {
    const {
      copyid,
      obt_mark2,
      eval_id2,
      eval_time2,
      annotations2,
      draw_annotations2,
    } = req.body;

    const result = await submitReevaluation({
      copyid,
      obt_mark2,
      eval_id2,
      eval_time2,
      annotations2,
      draw_annotations2,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to submit re-evaluation",
    });
  }
};