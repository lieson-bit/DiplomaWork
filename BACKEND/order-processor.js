module.exports = {
  generateOrderData: function (context, events, done) {
    const now = new Date();
    const timestamp = now.toISOString();
    
    context.vars.orderId = `ORD-LOAD-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    context.vars.createdAt = timestamp;
    context.vars.lastUpdated = timestamp;
    context.vars.pickupTime = timestamp;
    
    const deliveryTime = new Date(now.getTime() + 23.1 * 60000);
    context.vars.deliveryTime = deliveryTime.toISOString();
    
    context.vars.calculationTimestamp = new Date().toISOString();
    context.vars.driverSelectionTime = timestamp;
    
    return done();
  }
};